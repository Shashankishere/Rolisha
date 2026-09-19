/**
 * "Add to roadmap" for a job's missing skill(s).
 *
 * This is new logic — no such function existed before this change. It does
 * NOT touch `buildRoadmap()`/`regenerateRoadmapFor()` (the deterministic
 * 6-month generator) or `scoreJobMatch()`. Instead it appends a task for the
 * skill to the user's current active roadmap, in the first month that isn't
 * fully complete, so the skill shows up in their weekly plan without
 * regenerating (and thereby discarding progress on) the whole roadmap.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export interface AddSkillsToRoadmapResult {
  added: string[];
  alreadyPresent: string[];
}

export async function addMissingSkillsToRoadmap(
  supabase: Client,
  userId: string,
  jobId: string,
  skillIds: string[],
): Promise<AddSkillsToRoadmapResult> {
  if (skillIds.length === 0) return { added: [], alreadyPresent: [] };

  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("id, hours_per_week")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (roadmapError) throw new Error("Unable to load your roadmap.");
  if (!roadmap) {
    throw new Error("Generate a roadmap first, then add missing skills from a job to it.");
  }

  const [{ data: skills, error: skillsError }, { data: job, error: jobError }] = await Promise.all([
    supabase.from("skills").select("id, name").in("id", skillIds),
    supabase.from("jobs").select("title, company").eq("id", jobId).maybeSingle(),
  ]);
  if (skillsError) throw new Error("Unable to load those skills.");
  if (jobError) throw new Error("Unable to load this job.");

  const { data: months, error: monthsError } = await supabase
    .from("roadmap_months")
    .select("id, month_number, skills")
    .eq("roadmap_id", roadmap.id)
    .order("month_number");
  if (monthsError) throw new Error("Unable to load your roadmap months.");
  const monthRows = (months ?? []) as { id: string; month_number: number; skills: string[] }[];
  if (monthRows.length === 0) {
    throw new Error("Your roadmap has no months yet — regenerate it first.");
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("roadmap_tasks")
    .select("month_id, week_number, is_completed, skill_name, estimated_hours")
    .eq("roadmap_id", roadmap.id);
  if (tasksError) throw new Error("Unable to load your roadmap tasks.");
  const taskRows = (tasks ?? []) as {
    month_id: string;
    week_number: number;
    is_completed: boolean;
    skill_name: string | null;
    estimated_hours: number;
  }[];

  // First month that still has an incomplete task, else the last month.
  const incompleteMonthIds = new Set(
    taskRows.filter((t) => !t.is_completed).map((t) => t.month_id),
  );
  const targetMonth =
    monthRows.find((m) => incompleteMonthIds.has(m.id)) ?? monthRows[monthRows.length - 1]!;

  const existingTasksInMonth = taskRows.filter((t) => t.month_id === targetMonth.id);
  const existingSkillNames = new Set(
    existingTasksInMonth.map((t) => t.skill_name).filter((n): n is string => Boolean(n)),
  );
  const maxWeekInMonth = Math.max(0, ...existingTasksInMonth.map((t) => t.week_number));
  // The deterministic generator (buildRoadmap) lays every month out as a
  // fixed 4-week block: month N owns global weeks (N-1)*4+1..N*4. A new
  // task should stay inside its own month's block whenever there's room
  // left in it. Once a month's block is full, continuing to number weeks
  // as maxWeekInMonth+1, +2, ... would walk straight into the NEXT month's
  // block and collide with an already-existing week there -- the exact
  // "same week number appears in two different months" bug. So overflow
  // past the block instead continues from the highest week number used
  // anywhere in the whole roadmap, which by definition can't collide with
  // any existing week in any month.
  const monthNumber = (targetMonth as { month_number?: number }).month_number ?? 1;
  const monthBlockEnd = monthNumber * 4;
  const roomInBlock = Math.max(0, monthBlockEnd - maxWeekInMonth);
  const globalMaxWeek = Math.max(0, ...taskRows.map((t) => t.week_number));

  // Cap each added skill's task to the roadmap's own weekly-hours capacity
  // (default effort is 5h, but never more than the user actually selected)
  // so a newly-added week can't itself violate the hard weekly limit.
  const hoursPerWeek = (roadmap as { hours_per_week?: number }).hours_per_week;
  const addedTaskHours = Math.max(0.5, Math.min(5, hoursPerWeek ?? 5));

  const skillRows = (skills ?? []) as { id: string; name: string }[];
  const jobRow = job as { title: string; company: string } | null;
  const jobLabel = jobRow ? `${jobRow.title} at ${jobRow.company}` : "a job you viewed";

  const toAdd = skillRows.filter((s) => !existingSkillNames.has(s.name));
  const alreadyPresent = skillRows.filter((s) => existingSkillNames.has(s.name)).map((s) => s.name);

  if (toAdd.length > 0) {
    const { error: insertError } = await supabase.from("roadmap_tasks").insert(
      toAdd.map((skill, index) => ({
        roadmap_id: roadmap.id,
        month_id: targetMonth.id,
        user_id: userId,
        week_number:
          index < roomInBlock
            ? maxWeekInMonth + index + 1
            : globalMaxWeek + (index - roomInBlock) + 1,
        title: `Close the gap on ${skill.name}`,
        description: `Added from ${jobLabel}, which lists ${skill.name} as a required skill you don't have yet.`,
        skill_name: skill.name,
        estimated_hours: addedTaskHours,
      })),
    );
    if (insertError) throw new Error("Unable to add these skills to your roadmap.");

    const mergedSkills = [...new Set([...(targetMonth.skills ?? []), ...toAdd.map((s) => s.name)])];
    // Keep the month's displayed total genuinely derived from its own
    // persisted tasks (existing + newly added), never left stale at
    // whatever it was when the roadmap was first generated -- the same
    // "planned hours must match actual task data" rule that applies to
    // generation applies here too.
    const newEstimatedHours =
      existingTasksInMonth.reduce((sum, t) => sum + t.estimated_hours, 0) +
      toAdd.length * addedTaskHours;
    await supabase
      .from("roadmap_months")
      .update({ skills: mergedSkills, estimated_hours: newEstimatedHours })
      .eq("id", targetMonth.id);

    await supabase.from("progress_events").insert({
      user_id: userId,
      event_type: "skill_added_to_roadmap",
      label: `Added ${toAdd.map((s) => s.name).join(", ")} from ${jobLabel}`,
    });
  }

  return { added: toAdd.map((s) => s.name), alreadyPresent };
}
