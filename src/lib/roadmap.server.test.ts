import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import {
  buildRoadmap,
  findWeeklyCapacityViolations,
  loadRoadmapContent,
  type SkillLearningContent,
} from "@/lib/roadmap.server";
import type { SkillGapRow } from "@/lib/domain";

function gap(overrides: Partial<SkillGapRow> & { skillId: string; name: string }): SkillGapRow {
  return {
    importance: "high",
    requiredLevel: "advanced",
    demandPercentage: 50,
    yourLevel: "none",
    gapPercentage: 100,
    status: "missing",
    ...overrides,
  };
}

const REACT_CONTENT: SkillLearningContent = {
  topicTitle: "React Fundamentals",
  lessons: [
    { title: "JSX and components", practice: "Build a component that renders a list." },
    { title: "Props and state", practice: "Add a counter with local state." },
    { title: "Effects and data fetching", practice: "Fetch and render a list from an API." },
    { title: "Rendering and performance", practice: "Profile a re-render and memoize it." },
    { title: "Testing components", practice: "Write a test for the counter component." },
  ],
  resources: [
    {
      title: "React docs: Quick Start",
      provider: "react.dev",
      url: "https://react.dev/learn",
      type: "documentation",
    },
    {
      title: "React docs: Hooks",
      provider: "react.dev",
      url: "https://react.dev/reference/react",
      type: "documentation",
    },
  ],
  assessmentSlug: "react-fundamentals",
  assessmentTitle: "React Fundamentals",
};

describe("buildRoadmap", () => {
  it("produces 6 months with 4 weeks worth of work each", () => {
    const months = buildRoadmap({
      role: "Frontend Developer",
      gaps: [gap({ skillId: "s-react", name: "React" })],
      hoursPerWeek: 10,
    });
    expect(months).toHaveLength(6);
    const allWeeks = new Set(months.flatMap((m) => m.tasks.map((t) => t.weekNumber)));
    expect(Math.max(...allWeeks)).toBe(24);
    expect(Math.min(...allWeeks)).toBe(1);
  });

  it("is deterministic: identical input produces identical output", () => {
    const input = {
      role: "Data Analyst",
      gaps: [gap({ skillId: "s-sql", name: "SQL", importance: "critical" as const })],
      hoursPerWeek: 8,
      content: { "s-sql": REACT_CONTENT },
    };
    expect(buildRoadmap(input)).toEqual(buildRoadmap(input));
  });

  describe("content-aware weekly plans (Phase F/G/H regression)", () => {
    it("references real lesson titles from the content map instead of a generic paragraph", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 10,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 1);
      const lessonTask = week1Tasks.find((t) => t.title.startsWith("React:"));
      expect(lessonTask).toBeDefined();
      expect(lessonTask!.description).toContain("React Fundamentals");
      expect(lessonTask!.description).toMatch(/JSX and components|Props and state/);
    });

    it("includes a practice task pulled from the lesson's real practice field", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 10,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 1);
      const practiceTask = week1Tasks.find((t) => t.title.startsWith("Practise:"));
      expect(practiceTask).toBeDefined();
      expect([
        "Build a component that renders a list.",
        "Add a counter with local state.",
        "Fetch and render a list from an API.",
      ]).toContain(practiceTask!.description);
    });

    it("surfaces a real resource link when hours/week is high enough to warrant one", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 10,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 1);
      const resourceTask = week1Tasks.find((t) => t.title.startsWith("Resource:"));
      expect(resourceTask).toBeDefined();
      expect(resourceTask!.description).toContain("https://react.dev");
    });

    it("does NOT surface a resource task when hours/week is too low to add anything meaningful", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 3,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 1);
      expect(week1Tasks.some((t) => t.title.startsWith("Resource:"))).toBe(false);
    });

    it("uses the topic's real assessment as the month-end checkpoint instead of a generic review", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 10,
        content: { "s-react": REACT_CONTENT },
      });
      const week4Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 4);
      const checkpoint = week4Tasks.find((t) => t.title.includes("Checkpoint"));
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.title).toContain("React Fundamentals");
    });
  });

  describe("hours/week scaling (Phase I regression)", () => {
    it("a low hours/week user gets fewer lessons per week than a high hours/week user", () => {
      const lowHours = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 3,
        content: { "s-react": REACT_CONTENT },
      });
      const highHours = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 16,
        content: { "s-react": REACT_CONTENT },
      });
      const lowLessonTask = lowHours[0]!.tasks.find(
        (t) => t.weekNumber === 1 && t.title.startsWith("React:"),
      )!;
      const highLessonTask = highHours[0]!.tasks.find(
        (t) => t.weekNumber === 1 && t.title.startsWith("React:"),
      )!;
      const lowLessonCount = lowLessonTask.title.split(",").length;
      const highLessonCount = highLessonTask.title.split(",").length;
      expect(highLessonCount).toBeGreaterThan(lowLessonCount);
    });

    it("does not claim the same hour budget for a week regardless of actual content depth", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 10,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 1);
      // Multiple distinct tasks each carrying their own (smaller) hour
      // estimate, rather than one task claiming the full 10 hours for a
      // single generic paragraph.
      expect(week1Tasks.length).toBeGreaterThan(1);
      for (const t of week1Tasks) {
        expect(t.estimatedHours).toBeLessThan(10);
      }
    });
  });

  describe("proficiency skip-ahead (Phase M regression)", () => {
    it("a user with no experience starts from the first lesson", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React", yourLevel: "none" })],
        hoursPerWeek: 5,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Task = months[0]!.tasks.find(
        (t) => t.weekNumber === 1 && t.title.startsWith("React:"),
      )!;
      expect(week1Task.title).toContain("JSX and components");
    });

    it("a user who already has intermediate proficiency skips the earliest, most basic lessons", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [
          gap({
            skillId: "s-react",
            name: "React",
            yourLevel: "advanced",
            requiredLevel: "expert",
          }),
        ],
        hoursPerWeek: 5,
        content: { "s-react": REACT_CONTENT },
      });
      const week1Task = months[0]!.tasks.find(
        (t) => t.weekNumber === 1 && t.title.startsWith("React:"),
      )!;
      // advanced is 3/4 of the way to expert, so it should have skipped
      // past the introductory "JSX and components" lesson.
      expect(week1Task.title).not.toContain("JSX and components");
    });

    it("progresses through the lesson list across weeks instead of repeating the same lessons", () => {
      const months = buildRoadmap({
        role: "Frontend Developer",
        gaps: [gap({ skillId: "s-react", name: "React" })],
        hoursPerWeek: 5,
        content: { "s-react": REACT_CONTENT },
      });
      const reactLessonTasks = months
        .flatMap((m) => m.tasks)
        .filter((t) => t.title.startsWith("React:"))
        .slice(0, 3);
      const titles = reactLessonTasks.map((t) => t.title);
      expect(new Set(titles).size).toBe(titles.length);
    });
  });

  describe("fallback when a skill has no seeded learning content (Phase F regression)", () => {
    it("falls back to a generic, non-empty task instead of crashing or fabricating lesson titles", () => {
      const months = buildRoadmap({
        role: "Cloud Engineer",
        gaps: [gap({ skillId: "s-kubernetes", name: "Kubernetes" })],
        hoursPerWeek: 10,
        content: {}, // no content seeded yet for this skill
      });
      const week1Tasks = months[0]!.tasks.filter((t) => t.weekNumber === 1);
      expect(week1Tasks.length).toBeGreaterThan(0);
      expect(week1Tasks[0]!.title).toContain("Kubernetes");
    });

    it("works with no content argument at all", () => {
      expect(() =>
        buildRoadmap({
          role: "Cloud Engineer",
          gaps: [gap({ skillId: "s-kubernetes", name: "Kubernetes" })],
          hoursPerWeek: 10,
        }),
      ).not.toThrow();
    });
  });

  describe("career-specific ordering (Phase L regression)", () => {
    it("prioritises the skill weighted more critical for THIS career's gap first", () => {
      const frontendWeighted = buildRoadmap({
        role: "Frontend Developer",
        gaps: [
          gap({ skillId: "s-react", name: "React", importance: "critical" }),
          gap({ skillId: "s-sql", name: "SQL", importance: "nice_to_have" }),
        ],
        hoursPerWeek: 10,
      });
      const dataWeighted = buildRoadmap({
        role: "Data Analyst",
        gaps: [
          gap({ skillId: "s-react", name: "React", importance: "nice_to_have" }),
          gap({ skillId: "s-sql", name: "SQL", importance: "critical" }),
        ],
        hoursPerWeek: 10,
      });
      expect(frontendWeighted[0]!.skills[0]).toBe("React");
      expect(dataWeighted[0]!.skills[0]).toBe("SQL");
    });
  });

  it("still ends month 6 with a real send-applications task", () => {
    const months = buildRoadmap({
      role: "Frontend Developer",
      gaps: [gap({ skillId: "s-react", name: "React" })],
      hoursPerWeek: 10,
    });
    const finalWeekTasks = months[5]!.tasks.filter((t) => t.weekNumber === 24);
    expect(finalWeekTasks.some((t) => t.title.includes("Send applications"))).toBe(true);
  });
});

describe("weekly hour cap (production bug regression)", () => {
  const gaps = [
    gap({ skillId: "s-react", name: "React", importance: "critical" as const }),
    gap({ skillId: "s-sql", name: "SQL", importance: "high" as const }),
    gap({ skillId: "s-stats", name: "Statistics", importance: "medium" as const }),
  ];
  const content = { "s-react": REACT_CONTENT };

  it.each([2, 6, 10, 13, 16])(
    "no week ever exceeds the selected %i hours/week, across the whole 6-month plan",
    (hoursPerWeek) => {
      const months = buildRoadmap({ role: "Data Analyst", gaps, hoursPerWeek, content });
      const violations = findWeeklyCapacityViolations(months, hoursPerWeek);
      expect(violations).toEqual([]);
    },
  );

  it("a week's tasks (lesson + practice + resource) sum to at most the weekly cap, not just each task individually", () => {
    const months = buildRoadmap({
      role: "Data Analyst",
      gaps,
      hoursPerWeek: 6,
      content,
    });
    const week1Total = months[0]!.tasks
      .filter((t) => t.weekNumber === 1)
      .reduce((sum, t) => sum + t.estimatedHours, 0);
    expect(week1Total).toBeLessThanOrEqual(6);
  });

  it("a final-week checkpoint/assessment task never pushes the week over the cap", () => {
    const months = buildRoadmap({
      role: "Data Analyst",
      gaps,
      hoursPerWeek: 6,
      content,
    });
    const week4Total = months[0]!.tasks
      .filter((t) => t.weekNumber === 4)
      .reduce((sum, t) => sum + t.estimatedHours, 0);
    expect(week4Total).toBeLessThanOrEqual(6);
  });

  it("every logical week (1..24) belongs to exactly one month's 4-week block, never split or duplicated across months", () => {
    const months = buildRoadmap({ role: "Data Analyst", gaps, hoursPerWeek: 10, content });
    for (const month of months) {
      const blockStart = (month.monthNumber - 1) * 4 + 1;
      const blockEnd = month.monthNumber * 4;
      for (const task of month.tasks) {
        expect(task.weekNumber).toBeGreaterThanOrEqual(blockStart);
        expect(task.weekNumber).toBeLessThanOrEqual(blockEnd);
      }
    }
  });

  it("never produces fractional task hours, for any weekly capacity (production regression: estimated_hours is an INTEGER column)", () => {
    // Production incident: the allocator used to split a week's budget into
    // half-hour units (e.g. 3.5 + 2.5 = 6), and Postgres rejected the insert
    // with `22P02 invalid input syntax for type integer: "3.5"` because
    // `roadmap_tasks.estimated_hours` / `roadmap_months.estimated_hours` are
    // INTEGER columns. Every one of these hoursPerWeek values (including
    // odd numbers, which are exactly what used to force a ".5" split) must
    // now produce only whole-number task and month hours, while still never
    // exceeding the weekly cap.
    for (const hoursPerWeek of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const months = buildRoadmap({ role: "Data Analyst", gaps, hoursPerWeek, content });
      for (const month of months) {
        expect(Number.isInteger(month.estimatedHours)).toBe(true);
        for (const task of month.tasks) {
          expect(Number.isInteger(task.estimatedHours)).toBe(true);
        }
      }
      const violations = findWeeklyCapacityViolations(months, hoursPerWeek);
      expect(violations).toEqual([]);
    }
  });
});

describe("roadmap ticket regression: capacity, six-month coverage, zero-hour tasks", () => {
  const gaps = [
    gap({ skillId: "s-react", name: "React", importance: "critical" as const }),
    gap({ skillId: "s-sql", name: "SQL", importance: "high" as const }),
    gap({ skillId: "s-stats", name: "Statistics", importance: "medium" as const }),
  ];
  const content = { "s-react": REACT_CONTENT };

  // The exact hours/week values called out in the bug report.
  it.each([2, 4, 6, 10, 16, 24, 40])(
    "at %i hours/week: no week exceeds capacity, every week 1-24 has real work, no zero-hour tasks",
    (hoursPerWeek) => {
      const months = buildRoadmap({ role: "Data Analyst", gaps, hoursPerWeek, content });

      // 1) sum(task.hours for each logical week) <= hoursPerWeek
      expect(findWeeklyCapacityViolations(months, hoursPerWeek)).toEqual([]);

      // 2) all six months contain meaningful content -- no month is just a
      // heading with an empty task list.
      expect(months).toHaveLength(6);
      for (const month of months) {
        expect(month.tasks.length).toBeGreaterThan(0);
        expect(month.estimatedHours).toBeGreaterThan(0);
      }

      // 3) continuous chronological coverage: every logical week 1..24
      // appears exactly once as a group (no gaps, no duplicated weeks
      // spanning two months).
      const weeksSeen = months.flatMap((m) => m.tasks.map((t) => t.weekNumber));
      const uniqueWeeks = new Set(weeksSeen);
      expect(Math.min(...uniqueWeeks)).toBe(1);
      expect(Math.max(...uniqueWeeks)).toBe(24);
      expect(uniqueWeeks.size).toBe(24);

      // 4) no persisted task ever has a zero (or negative) duration, and
      // every task's hours are a whole number (estimated_hours is an
      // INTEGER column -- see the fractional-hours regression test above).
      for (const task of months.flatMap((m) => m.tasks)) {
        expect(task.estimatedHours).toBeGreaterThan(0);
        expect(Number.isInteger(task.estimatedHours)).toBe(true);
      }

      // 5) the displayed month total genuinely equals the sum of its own
      // persisted task hours -- not an independent weeklyHours*4 estimate.
      for (const month of months) {
        const actual = month.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
        expect(month.estimatedHours).toBeCloseTo(actual, 5);
      }
    },
  );

  it("a very low-availability user (1h/week) still gets a valid, non-empty progression with no zero-hour tasks", () => {
    const months = buildRoadmap({ role: "Data Analyst", gaps, hoursPerWeek: 1, content });
    expect(findWeeklyCapacityViolations(months, 1)).toEqual([]);
    for (const month of months) {
      expect(month.tasks.length).toBeGreaterThan(0);
    }
    for (const task of months.flatMap((m) => m.tasks)) {
      expect(task.estimatedHours).toBeGreaterThan(0);
    }
  });

  it("a user with no outstanding gaps at all (empty gap list) still gets six non-empty, consolidation-themed months instead of empty headings", () => {
    const months = buildRoadmap({ role: "Backend Developer", gaps: [], hoursPerWeek: 6 });
    expect(months).toHaveLength(6);
    for (const month of months) {
      expect(month.tasks.length).toBeGreaterThan(0);
      expect(month.tasks.every((t) => t.estimatedHours > 0)).toBe(true);
    }
    expect(findWeeklyCapacityViolations(months, 6)).toEqual([]);
  });

  it("displayed month total reflects the actual generated consolidation-week tasks, not an independent weeklyHours*4 estimate (production bug regression)", () => {
    // A user with no outstanding gap now gets a full, real week of advanced
    // application/practice/revision work (not idle "keep it sharp" time),
    // so the total legitimately can equal weeklyHours*4 -- the invariant
    // that matters is that the badge is DERIVED from the actual tasks,
    // never computed independently of them.
    const months = buildRoadmap({ role: "Backend Developer", gaps: [], hoursPerWeek: 6 });
    for (const month of months) {
      const actual = month.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
      expect(month.estimatedHours).toBe(actual);
    }
  });

  it("a consolidation month (no outstanding gap) generates real, varied advanced-practitioner tasks instead of a single repeated 'keep it sharp' line", () => {
    const gaps = [
      {
        skillId: "s-known",
        name: "React",
        importance: "high" as const,
        requiredLevel: "advanced" as const,
        demandPercentage: 50,
        yourLevel: "expert" as const,
        gapPercentage: 0,
        status: "ready" as const,
      },
    ];
    const months = buildRoadmap({ role: "Frontend Developer", gaps, hoursPerWeek: 10 });
    const consolidationMonth = months[0]!;
    expect(consolidationMonth.tasks.length).toBeGreaterThan(0);
    // Not every task in the month is the exact same title -- real variety
    // across the 4 weeks (apply / go deeper / revise / rehearse).
    const titles = new Set(consolidationMonth.tasks.map((t) => t.title));
    expect(titles.size).toBeGreaterThan(1);
    // References the user's actual known strength by name, not a
    // placeholder.
    expect(consolidationMonth.tasks.some((t) => t.title.includes("React"))).toBe(true);
  });

  it("a fully-qualified user (no gaps at all) still gets a real send-applications task in the final month", () => {
    const months = buildRoadmap({ role: "Backend Developer", gaps: [], hoursPerWeek: 6 });
    const finalMonthTasks = months[5]!.tasks;
    expect(finalMonthTasks.some((t) => t.title.includes("Send applications"))).toBe(true);
  });

  it("every logical week's tasks group together (one Week N heading, not the same week repeated)", () => {
    const months = buildRoadmap({ role: "Data Analyst", gaps, hoursPerWeek: 10, content });
    const weekToMonths = new Map<number, Set<number>>();
    for (const month of months) {
      for (const task of month.tasks) {
        const set = weekToMonths.get(task.weekNumber) ?? new Set<number>();
        set.add(month.monthNumber);
        weekToMonths.set(task.weekNumber, set);
      }
    }
    // Each logical week's tasks all belong to a single month -- never split
    // across two different month buckets.
    for (const [, monthSet] of weekToMonths) {
      expect(monthSet.size).toBe(1);
    }
  });
});

describe("loadRoadmapContent", () => {
  it("returns an empty map for an empty skill list without querying anything", async () => {
    const fake = createFakeSupabase();
    const result = await loadRoadmapContent(fake, []);
    expect(result).toEqual({});
  });

  it("loads lessons ordered by sort_order, resources, and the topic's real linked assessment", async () => {
    const fake = createFakeSupabase();
    fake.seed("learning_topics", [
      {
        id: "topic-react",
        title: "React Fundamentals",
        skill_id: "s-react",
        assessments: { slug: "react-fundamentals", title: "React Fundamentals" },
      },
    ]);
    fake.seed("learning_lessons", [
      {
        topic_id: "topic-react",
        sort_order: 2,
        title: "Props and state",
        practice: "Add a counter.",
      },
      {
        topic_id: "topic-react",
        sort_order: 1,
        title: "JSX and components",
        practice: "Render a list.",
      },
    ]);
    fake.seed("resources", [
      {
        skill_id: "s-react",
        title: "React docs",
        provider: "react.dev",
        url: "https://react.dev/learn",
        type: "documentation",
      },
    ]);

    const result = await loadRoadmapContent(fake, ["s-react"]);
    expect(result["s-react"]).toBeDefined();
    expect(result["s-react"]!.topicTitle).toBe("React Fundamentals");
    expect(result["s-react"]!.lessons.map((l) => l.title)).toEqual([
      "JSX and components",
      "Props and state",
    ]);
    expect(result["s-react"]!.resources).toHaveLength(1);
    expect(result["s-react"]!.assessmentTitle).toBe("React Fundamentals");
  });

  it("omits a skill entirely when it has no learning_topics row, rather than an empty placeholder entry", async () => {
    const fake = createFakeSupabase();
    fake.seed("learning_topics", []);
    const result = await loadRoadmapContent(fake, ["s-kubernetes"]);
    expect(result["s-kubernetes"]).toBeUndefined();
  });

  it("dedupes repeated skill ids", async () => {
    const fake = createFakeSupabase();
    fake.seed("learning_topics", [
      { id: "topic-react", title: "React Fundamentals", skill_id: "s-react", assessments: null },
    ]);
    const result = await loadRoadmapContent(fake, ["s-react", "s-react", "s-react"]);
    expect(Object.keys(result)).toEqual(["s-react"]);
  });
});
