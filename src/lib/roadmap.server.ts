/**
 * Deterministic 6-month roadmap engine.
 *
 * The plan is derived from the user's skill gap ordered by importance and gap
 * size, then packed into six months and weekly tasks sized to the hours the
 * user actually has. Deterministic on purpose: the same gap (and the same
 * learning content) always produces the same plan, so the roadmap is
 * explainable.
 *
 * `buildRoadmap` stays a pure function -- no I/O, no randomness -- so it's
 * cheap to unit test exhaustively. The optional `content` map is real
 * learning-catalog data (lessons, resources, the topic's actual assessment)
 * fetched by the caller via `loadRoadmapContent` before calling this. When a
 * skill has no seeded learning content yet (true for some of the newest
 * additions to the skills catalog), the week falls back to a clearly-labeled
 * generic task instead of an empty or fabricated one -- never silently
 * inventing lesson titles or resource links that don't exist in the catalog.
 */
import {
  IMPORTANCE_WEIGHT,
  PROFICIENCY_LABEL,
  PROFICIENCY_VALUE,
  type SkillGapRow,
} from "@/lib/domain";

export interface PlannedTask {
  weekNumber: number;
  title: string;
  description: string;
  skillName: string | null;
  estimatedHours: number;
}

export interface PlannedMonth {
  monthNumber: number;
  title: string;
  goal: string;
  topics: string[];
  skills: string[];
  estimatedHours: number;
  projectTitle: string | null;
  projectDescription: string | null;
  milestone: string;
  assessmentSkill: string | null;
  tasks: PlannedTask[];
}

/** Real learning-catalog data for one skill, as loaded by `loadRoadmapContent`. */
export interface RoadmapLessonRef {
  title: string;
  practice: string | null;
}
export interface RoadmapResourceRef {
  title: string;
  provider: string | null;
  url: string;
  type: string;
}
export interface SkillLearningContent {
  topicTitle: string;
  /** Ordered by sort_order -- earlier entries are assumed to be more
   * foundational, which is what lets `startingLessonIndex` skip ahead for a
   * user who already has some proficiency instead of re-teaching basics. */
  lessons: RoadmapLessonRef[];
  resources: RoadmapResourceRef[];
  assessmentSlug: string | null;
  assessmentTitle: string | null;
}

const MONTH_THEMES = [
  { title: "Foundations", milestone: "Comfortable with the core tooling and vocabulary" },
  { title: "Core skills", milestone: "Can complete guided exercises without help" },
  { title: "Applied practice", milestone: "First end-to-end piece of work shipped" },
  { title: "Portfolio depth", milestone: "A portfolio project a hiring manager can read" },
  { title: "Interview readiness", milestone: "Can explain your work and answer role questions" },
  { title: "Applying", milestone: "Applications out and a repeatable interview routine" },
];

/** Highest-value gaps first: importance weight x how far away you are. This
 * is also what makes the roadmap career-specific without any extra logic --
 * different careers weight different skills as critical/high/medium in
 * career_skills, so the same gap list sorts differently per career. */
function prioritise(gaps: SkillGapRow[]): SkillGapRow[] {
  return [...gaps]
    .filter((g) => g.gapPercentage > 0)
    .sort(
      (a, b) =>
        IMPORTANCE_WEIGHT[b.importance] * b.gapPercentage -
        IMPORTANCE_WEIGHT[a.importance] * a.gapPercentage,
    );
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** How many real lessons to cover in a single week, scaled to the hours the
 * user actually has available -- this is the direct fix for a week claiming
 * to be "10 hours" of work while containing content completable in one. */
function lessonsPerWeek(weeklyHours: number): number {
  if (weeklyHours <= 4) return 1;
  if (weeklyHours <= 8) return 2;
  if (weeklyHours <= 13) return 3;
  return 4;
}

/** Skip ahead into a skill's lesson sequence for a user who already has some
 * proficiency in it, instead of re-teaching material from zero. Lessons are
 * authored in increasing depth (sort_order), so proficiency-as-a-fraction of
 * the sequence is a reasonable, deterministic proxy without needing a
 * per-lesson difficulty tag in the schema. */
function startingLessonIndex(yourLevel: SkillGapRow["yourLevel"], lessonCount: number): number {
  if (lessonCount === 0) return 0;
  const fraction = PROFICIENCY_VALUE[yourLevel] / PROFICIENCY_VALUE.expert;
  return Math.min(Math.floor(lessonCount * fraction), Math.max(0, lessonCount - 1));
}

/**
 * Splits a week's hour budget across a set of weighted tasks so the parts
 * can NEVER sum to more than `total` -- this is the direct fix for a week's
 * independently-rounded tasks (e.g. 60% + 25% + 15%, each rounded on its
 * own) silently adding up to more hours than the user selected.
 *
 * PRODUCTION INCIDENT (root cause of the `estimated_hours` insert failure):
 * this used to divide the budget into HALF-hour units (`Math.floor(total *
 * 2)`, then `/ 2` on the way out) so the largest-remainder split could still
 * hit an exact total like 6 = 3.5 + 2.5. That's mathematically elegant but
 * `roadmap_tasks.estimated_hours` and `roadmap_months.estimated_hours` are
 * INTEGER columns in Postgres, so inserting a task with 3.5 hours failed
 * with `22P02 invalid input syntax for type integer: "3.5"`.
 *
 * The fix keeps the exact same largest-remainder algorithm -- it's still
 * the right way to split a budget across weighted parts without drift --
 * but now works entirely in WHOLE-hour units. `total` is always a whole
 * number by the time it reaches here (see `weeklyHours` below, which
 * rounds the user's selected hours/week), so every returned value is an
 * integer, and because the algorithm always distributes every last unit of
 * `capUnits`, the parts sum to exactly `total` (never more) rather than
 * being independently rounded and silently exceeding it. A weight of 0 (or
 * a total so small the proportional share rounds down to nothing) can
 * legitimately come back as 0 hours -- callers should skip creating that
 * task rather than schedule a 0-hour item.
 */
function allocateHours(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const capUnits = Math.max(0, Math.floor(total));
  const positive = weights.map((w) => Math.max(0, w));
  const weightSum = positive.reduce((a, b) => a + b, 0) || 1;

  const raw = positive.map((w) => (w / weightSum) * capUnits);
  const units = raw.map((r) => Math.floor(r));
  let remaining = capUnits - units.reduce((a, b) => a + b, 0);

  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byRemainder) {
    if (remaining <= 0) break;
    units[i]! += 1;
    remaining -= 1;
  }
  return units;
}

/** Tracks, per skill, which lesson to serve next -- so a skill that spans
 * multiple weeks (because the bucket for its month has fewer entries than 4
 * weeks) works through its lesson list progressively instead of repeating
 * the same starting lessons every time it comes up. */
class LessonCursor {
  private next = new Map<string, number>();

  take(
    skillId: string,
    yourLevel: SkillGapRow["yourLevel"],
    lessons: RoadmapLessonRef[],
    count: number,
  ) {
    if (!this.next.has(skillId)) {
      this.next.set(skillId, startingLessonIndex(yourLevel, lessons.length));
    }
    const start = this.next.get(skillId)!;
    const slice = lessons.slice(start, start + count);
    this.next.set(skillId, start + slice.length);
    return slice;
  }
}

function genericLessonTask(
  weekNumber: number,
  skillName: string,
  role: string,
  weeklyHours: number,
  week: 1 | 2 | 3,
): PlannedTask {
  const plans: Record<1 | 2 | 3, { title: string; description: string }> = {
    1: {
      title: `Learn the fundamentals of ${skillName}`,
      description: `Work through a structured introduction to ${skillName} and take notes you can revisit. Target ${weeklyHours} focused hours.`,
    },
    2: {
      title: `Practise ${skillName} with exercises`,
      description: `Complete hands-on exercises in ${skillName} until you can finish them without looking things up.`,
    },
    3: {
      title: `Apply ${skillName} to a small task`,
      description: `Use ${skillName} on a realistic mini task related to ${role} work. Keep the output in your portfolio folder.`,
    },
  };
  const plan = plans[week];
  return {
    weekNumber,
    title: plan.title,
    description: plan.description,
    skillName,
    estimatedHours: weeklyHours,
  };
}

/**
 * Real, non-generic content for a week that has no remaining skill gap to
 * teach -- a user who's already strong across a month's would-be focus
 * skills. Previously this collapsed to a single "keep it sharp" task using
 * a fraction of the week's budget, which under-used the user's selected
 * capacity AND read as filler rather than a genuine month of work (the
 * "roadmap has nothing to learn" complaint). Instead this rotates through
 * real advanced-practitioner activities -- applying a known strength,
 * deepening it past the basics, revising it from memory, and rehearsing
 * explaining it -- each grounded in a skill the user actually has, sized
 * to the full weekly budget via the same `allocateHours` split every other
 * week uses.
 */
function consolidationSlots(
  role: string,
  strengths: string[],
  projectTitle: string | null,
  weekInMonth: 1 | 2 | 3 | 4,
): { weight: number; make: (hours: number) => PlannedTask }[] {
  const primary = strengths[0] ?? role;
  const secondary = strengths[1] ?? primary;
  const buildTarget = projectTitle ? `"${projectTitle}"` : `a ${role}-relevant build`;

  const archetypes: Record<1 | 2 | 3 | 4, { title: string; description: string; skill: string }> = {
    1: {
      title: `Apply ${primary} in ${buildTarget}`,
      description: `Put ${primary} to work on ${buildTarget} instead of another isolated exercise -- real, portfolio-worthy output beats re-covering material you already know.`,
      skill: primary,
    },
    2: {
      title: `Go deeper on ${primary}`,
      description: `Take on a harder ${primary} problem than your usual level -- an edge case, a performance concern, or a pattern you've only used at a surface level so far.`,
      skill: primary,
    },
    3: {
      title: `Revise ${secondary} from memory`,
      description: `Redo a past ${secondary} exercise without notes or references, then check where it broke down. This is what keeps a known skill from quietly going stale.`,
      skill: secondary,
    },
    4: {
      title: `Rehearse explaining ${primary}`,
      description: `Practice explaining ${primary} and a real decision you made using it, out loud, in under two minutes -- the same thing an interviewer will actually ask.`,
      skill: primary,
    },
  };
  const primaryPlan = archetypes[weekInMonth];

  return [
    {
      weight: 0.7,
      make: (hours) => ({
        weekNumber: 0, // overwritten by caller
        title: primaryPlan.title,
        description: primaryPlan.description,
        skillName: primaryPlan.skill,
        estimatedHours: hours,
      }),
    },
    {
      weight: 0.3,
      make: (hours) => ({
        weekNumber: 0, // overwritten by caller
        title: `Light review: ${secondary}`,
        description: `A short, low-effort touchpoint on ${secondary} so it stays fresh while most of this week goes to the main activity above.`,
        skillName: secondary,
        estimatedHours: hours,
      }),
    },
  ];
}

export function buildRoadmap(options: {
  role: string;
  gaps: SkillGapRow[];
  hoursPerWeek: number;
  projectTitles?: string[];
  /** Real learning content keyed by skillId, from `loadRoadmapContent`.
   * Skills with no entry fall back to the generic (but still real,
   * non-fabricated) week plan. */
  content?: Record<string, SkillLearningContent>;
}): PlannedMonth[] {
  const { role, gaps, hoursPerWeek, content } = options;
  const weeklyHours = Math.min(40, Math.max(1, Math.round(hoursPerWeek)));
  const ordered = prioritise(gaps);
  const strengths = gaps.filter((g) => g.gapPercentage === 0).map((g) => g.name);
  const lessonsThisWeek = lessonsPerWeek(weeklyHours);
  const cursor = new LessonCursor();

  // Spread the prioritised gaps across the first five months; month six is
  // reserved for applying, but still revisits the weakest critical skill.
  const learningMonths = 5;
  const perMonth = Math.max(1, Math.ceil(ordered.length / learningMonths));
  const buckets = chunk(ordered, perMonth).slice(0, learningMonths);
  while (buckets.length < learningMonths) buckets.push([]);

  return MONTH_THEMES.map((theme, index) => {
    const monthNumber = index + 1;
    const isFinalMonth = monthNumber === 6;
    const bucket = isFinalMonth ? ordered.slice(0, 2) : (buckets[index] ?? []);
    const skills = bucket.map((g) => g.name);

    const topics = bucket.length
      ? bucket.map((g) => `${g.name} → reach ${PROFICIENCY_LABEL[g.requiredLevel]}`)
      : strengths.slice(0, 3).map((name) => `Keep ${name} sharp`);

    const tasks: PlannedTask[] = [];
    for (let week = 1; week <= 4; week += 1) {
      const globalWeek = (monthNumber - 1) * 4 + week;
      const focus = bucket[(week - 1) % Math.max(1, bucket.length)];
      const isFinalWeek = week === 4;

      if (!focus) {
        // No gap left for this month at all -- a real (if lighter) week of
        // advanced/consolidation work for an already-strong skill, not a
        // re-teach and not a single token task. Still goes through
        // allocateHours like every other week, and still gets the
        // final-month "send applications" task -- a fully-qualified user
        // reaching month 6 should still be pushed to apply, not just told
        // to keep sharp for a fourth month running.
        type WeekSlot = { weight: number; make: (hours: number) => PlannedTask };
        const slots: WeekSlot[] = consolidationSlots(
          role,
          strengths,
          options.projectTitles?.[index] ?? null,
          week as 1 | 2 | 3 | 4,
        );
        if (isFinalWeek && isFinalMonth) {
          slots.push({
            weight: 0.2,
            make: (hours) => ({
              weekNumber: globalWeek,
              title: "Send applications and review feedback",
              description:
                "Send applications for roles you match on, log them in the tracker and review the feedback loop each week.",
              skillName: strengths[0] ?? role,
              estimatedHours: hours,
            }),
          });
        }
        const allocated = allocateHours(
          weeklyHours,
          slots.map((s) => s.weight),
        );
        for (let i = 0; i < slots.length; i += 1) {
          if (allocated[i]! > 0) {
            const task = slots[i]!.make(allocated[i]!);
            tasks.push({ ...task, weekNumber: globalWeek });
          }
        }
        continue;
      }

      const skillContent = content?.[focus.skillId];

      // Every task that will land in THIS week is described as a weighted
      // slot first, then given its hours in one shot by `allocateHours` --
      // that's what makes it impossible for the week's tasks to sum above
      // `weeklyHours`, unlike computing each task's hours independently.
      type WeekSlot = { weight: number; make: (hours: number) => PlannedTask };
      const slots: WeekSlot[] = [];

      if (skillContent && skillContent.lessons.length > 0) {
        const lessons = cursor.take(
          focus.skillId,
          focus.yourLevel,
          skillContent.lessons,
          lessonsThisWeek,
        );

        if (lessons.length > 0) {
          const lessonTitles = lessons.map((l) => l.title);
          slots.push({
            weight: 0.6,
            make: (hours) => ({
              weekNumber: globalWeek,
              title:
                lessons.length === 1
                  ? `${focus.name}: ${lessonTitles[0]}`
                  : `${focus.name}: ${lessonTitles.join(", ")}`,
              description: `From the ${skillContent.topicTitle} learning path — work through ${lessons.length === 1 ? "this lesson" : `these ${lessons.length} lessons`}: ${lessonTitles.join("; ")}.`,
              skillName: focus.name,
              estimatedHours: hours,
            }),
          });
          const lastLesson = lessons[lessons.length - 1]!;
          const practice = lastLesson.practice;
          slots.push({
            weight: 0.25,
            make: (hours) => ({
              weekNumber: globalWeek,
              title: `Practise: ${lessonTitles[lessonTitles.length - 1]}`,
              description:
                practice ??
                `Complete hands-on exercises in ${focus.name} until you can finish them without looking things up.`,
              skillName: focus.name,
              estimatedHours: hours,
            }),
          });
        } else {
          // This skill's lesson list is exhausted for this user (they've
          // worked through everything seeded) -- move to applying it rather
          // than repeating or fabricating more lessons.
          slots.push({
            weight: 0.7,
            make: (hours) => genericLessonTask(globalWeek, focus.name, role, hours, 3),
          });
        }

        if (skillContent.resources.length > 0 && weeklyHours > 4) {
          const resource =
            skillContent.resources[(globalWeek - 1) % skillContent.resources.length]!;
          slots.push({
            weight: 0.15,
            make: (hours) => ({
              weekNumber: globalWeek,
              title: `Resource: ${resource.title}`,
              description: `${resource.provider ? `${resource.provider} — ` : ""}${resource.url}`,
              skillName: focus.name,
              estimatedHours: hours,
            }),
          });
        }
      } else {
        // No seeded learning content for this skill yet -- fall back to a
        // clearly generic (but still real, sized-to-hours) task rather than
        // inventing lesson names that don't exist in the catalog.
        const genericWeek = (((week - 1) % 3) + 1) as 1 | 2 | 3;
        slots.push({
          weight: 1,
          make: (hours) => genericLessonTask(globalWeek, focus.name, role, hours, genericWeek),
        });
      }

      if (isFinalWeek) {
        if (isFinalMonth) {
          slots.push({
            weight: 0.2,
            make: (hours) => ({
              weekNumber: globalWeek,
              title: "Send applications and review feedback",
              description:
                "Send applications for roles you match on, log them in the tracker and review the feedback loop each week.",
              skillName: focus.name,
              estimatedHours: hours,
            }),
          });
        } else if (skillContent?.assessmentTitle) {
          slots.push({
            weight: 0.1,
            make: (hours) => ({
              weekNumber: globalWeek,
              title: `Checkpoint: take the ${skillContent.assessmentTitle} assessment`,
              description: `Take the ${skillContent.assessmentTitle} assessment to confirm you've actually retained what this month covered on ${focus.name}, not just recognised it.`,
              skillName: focus.name,
              estimatedHours: hours,
            }),
          });
        } else {
          slots.push({
            weight: 0.1,
            make: (hours) => ({
              weekNumber: globalWeek,
              title: `Review and consolidate month ${monthNumber}`,
              description: `Summarise what you learned, redo the hardest exercise from scratch and take the ${focus.name} assessment if one is available.`,
              skillName: focus.name,
              estimatedHours: hours,
            }),
          });
        }
      }

      const allocated = allocateHours(
        weeklyHours,
        slots.map((s) => s.weight),
      );
      for (let i = 0; i < slots.length; i += 1) {
        // A slot can legitimately be handed 0 hours when the week's budget
        // is too tight to fit every optional extra (e.g. a 1h/week user in
        // a checkpoint week) -- skip creating a 0-hour task rather than
        // let it silently push the week over budget.
        if (allocated[i]! > 0) tasks.push(slots[i]!.make(allocated[i]!));
      }
    }

    const projectTitle = options.projectTitles?.[index] ?? null;

    // Derived from the actual persisted tasks, never from a separate
    // weeklyHours*4 estimate -- a consolidation-only month (e.g. a user with
    // no outstanding gap for that stretch) legitimately schedules lighter
    // weeks, and the displayed total must reflect that instead of
    // overstating a full week's capacity for every week.
    const estimatedHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    return {
      monthNumber,
      title: `Month ${monthNumber}: ${theme.title}`,
      goal: isFinalMonth
        ? `Apply for ${role} roles with a portfolio and a rehearsed story for each project.`
        : bucket.length
          ? `Close the gap on ${skills.slice(0, 3).join(", ")}.`
          : `Consolidate your existing ${role} skills and deepen your portfolio.`,
      topics,
      skills,
      estimatedHours,
      projectTitle,
      projectDescription: projectTitle
        ? `Build "${projectTitle}" using the skills from this month and publish the repository with a README.`
        : null,
      milestone: theme.milestone,
      assessmentSkill: bucket[0]?.name ?? null,
      tasks,
    };
  });
}

export interface WeeklyCapacityViolation {
  weekNumber: number;
  totalHours: number;
  limit: number;
}

/**
 * Deterministic server-side check that no generated week exceeds the
 * user's selected `hoursPerWeek` -- run this after `buildRoadmap` and
 * before persisting/returning the plan. `allocateHours` already makes this
 * mathematically impossible for the engine's own output, but this function
 * is the actual enforcement point: it re-derives the same weekly totals a
 * consumer would see (grouping every task by `weekNumber` the way the
 * roadmap is rendered) so a future change to the generator -- or a
 * differently-sourced plan -- can't silently reintroduce the bug without a
 * caller noticing. Returns an empty array when the plan is valid.
 */
export function findWeeklyCapacityViolations(
  months: PlannedMonth[],
  hoursPerWeek: number,
): WeeklyCapacityViolation[] {
  const limit = Math.min(40, Math.max(1, Math.round(hoursPerWeek)));
  const totals = new Map<number, number>();
  for (const month of months) {
    for (const task of month.tasks) {
      totals.set(task.weekNumber, (totals.get(task.weekNumber) ?? 0) + task.estimatedHours);
    }
  }
  const violations: WeeklyCapacityViolation[] = [];
  for (const [weekNumber, totalHours] of totals) {
    // Small epsilon guards against harmless floating-point noise (e.g.
    // 1.5 + 2 + 2.5 landing on 5.999999999999999) without masking a real
    // overage.
    if (totalHours > limit + 1e-9) violations.push({ weekNumber, totalHours, limit });
  }
  return violations.sort((a, b) => a.weekNumber - b.weekNumber);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/**
 * Loads real learning-catalog content (topic, lessons, resources, the
 * topic's actual linked assessment) for a batch of skills in a small,
 * fixed number of queries -- used to feed `buildRoadmap`'s `content` option
 * before generating a roadmap. Skills with no `learning_topics` row yet
 * (some of the newest additions to the skills catalog) simply don't appear
 * in the returned map; `buildRoadmap` handles that with its generic-task
 * fallback rather than fabricating content for them.
 */
export async function loadRoadmapContent(
  supabase: Client,
  skillIds: string[],
): Promise<Record<string, SkillLearningContent>> {
  const ids = [...new Set(skillIds)].filter(Boolean);
  if (ids.length === 0) return {};

  const [{ data: topics, error: topicsError }, { data: resources, error: resourcesError }] =
    await Promise.all([
      supabase
        .from("learning_topics")
        .select("id, title, skill_id, assessments(slug, title)")
        .in("skill_id", ids),
      supabase.from("resources").select("title, provider, url, type, skill_id").in("skill_id", ids),
    ]);
  if (topicsError) throw new Error("Unable to load learning content for the roadmap.");
  if (resourcesError) throw new Error("Unable to load resources for the roadmap.");

  const topicRows = (topics ?? []) as any[];
  const topicIds = topicRows.map((t) => t.id);

  const { data: lessons, error: lessonsError } = topicIds.length
    ? await supabase
        .from("learning_lessons")
        .select("topic_id, sort_order, title, practice")
        .in("topic_id", topicIds)
        .order("sort_order", { ascending: true })
    : { data: [] as any[], error: null };
  if (lessonsError) throw new Error("Unable to load lessons for the roadmap.");

  const lessonsByTopic = new Map<string, RoadmapLessonRef[]>();
  for (const lesson of (lessons ?? []) as any[]) {
    const list = lessonsByTopic.get(lesson.topic_id) ?? [];
    list.push({ title: lesson.title, practice: lesson.practice ?? null });
    lessonsByTopic.set(lesson.topic_id, list);
  }

  const resourcesBySkill = new Map<string, RoadmapResourceRef[]>();
  for (const r of (resources ?? []) as any[]) {
    const list = resourcesBySkill.get(r.skill_id) ?? [];
    list.push({ title: r.title, provider: r.provider ?? null, url: r.url, type: r.type });
    resourcesBySkill.set(r.skill_id, list);
  }

  const out: Record<string, SkillLearningContent> = {};
  for (const t of topicRows) {
    out[t.skill_id] = {
      topicTitle: t.title,
      lessons: lessonsByTopic.get(t.id) ?? [],
      resources: resourcesBySkill.get(t.skill_id) ?? [],
      assessmentSlug: t.assessments?.slug ?? null,
      assessmentTitle: t.assessments?.title ?? null,
    };
  }
  return out;
}
