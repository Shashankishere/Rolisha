import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getRoadmap,
  regenerateRoadmap,
  setTaskCompletion,
  getCareerRoadmaps,
  addCareerRoadmapFn,
  setPrimaryCareerRoadmapFn,
} from "@/lib/me.functions";
import { getLearningTopicRefs } from "@/lib/learning.functions";
import { getProjects } from "@/lib/projects.functions";
import { getAssessments } from "@/lib/assessments.functions";
import { listCareers } from "@/lib/catalog.functions";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { workspaceQuery } from "@/routes/_authenticated/dashboard";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";
import { PROFICIENCY_LABEL, stripMonthNumberPrefix } from "@/lib/domain";
import type { RoadmapTaskView } from "@/lib/me-types";
import { Check, ClipboardCheck, FolderGit2, GraduationCap, Lock, Star } from "lucide-react";
import { LockedBadge, showMutationError } from "@/components/app/upgrade-prompt";

const roadmapQuery = queryOptions({ queryKey: ["roadmap"], queryFn: () => getRoadmap() });

/**
 * Groups a month's flat task list by week number for display. The
 * underlying data legitimately has multiple `roadmap_tasks` rows per week
 * (a lesson, a practice task, a resource, ...) -- that's by design, not a
 * bug. The bug was rendering each of those rows with its own "Week N:"
 * label, which reads as the same week appearing three times with
 * different content. Grouping here (once, at the presentation layer)
 * fixes that without touching the underlying data model.
 */
function groupTasksByWeek(tasks: RoadmapTaskView[]) {
  const byWeek = new Map<number, RoadmapTaskView[]>();
  for (const task of tasks) {
    const list = byWeek.get(task.weekNumber) ?? [];
    list.push(task);
    byWeek.set(task.weekNumber, list);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekNumber, weekTasks]) => ({
      weekNumber,
      totalHours: weekTasks.reduce((sum, t) => sum + t.estimatedHours, 0),
      tasks: weekTasks,
    }));
}

export const Route = createFileRoute("/_authenticated/roadmap")({
  loader: ({ context }) => context.queryClient.ensureQueryData(roadmapQuery),
  head: () => ({
    meta: [{ title: "Roadmap — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="roadmap"
      title="Roadmap unavailable"
      description="Please refresh to try again."
    />
  ),
  component: RoadmapPage,
});

function RoadmapPage() {
  const { data: roadmap } = useSuspenseQuery(roadmapQuery);
  const { data: workspace } = useSuspenseQuery(workspaceQuery);
  const { data: topicRefs } = useQuery({
    queryKey: ["learning-topic-refs"],
    queryFn: () => getLearningTopicRefs(),
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  const { data: assessmentsData } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => getAssessments(),
  });
  const queryClient = useQueryClient();

  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });
  const isPro = subscription?.features.multiple_career_roadmaps === true;
  const { data: careerRoadmaps } = useQuery({
    queryKey: ["career-roadmaps"],
    queryFn: () => getCareerRoadmaps(),
    enabled: isPro,
  });
  const { data: careers } = useQuery({
    queryKey: ["careers"],
    queryFn: () => listCareers(),
    enabled: isPro,
  });

  function invalidateAfterRoadmapChange() {
    queryClient.invalidateQueries({ queryKey: ["career-roadmaps"] });
    queryClient.invalidateQueries({ queryKey: ["roadmap"] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  }
  const addRoadmap = useMutation({
    mutationFn: (careerId: string) => addCareerRoadmapFn({ data: { careerId } }),
    onSuccess: invalidateAfterRoadmapChange,
    onError: (error) => showMutationError(error, "Could not add that career roadmap."),
  });
  const switchPrimary = useMutation({
    mutationFn: (roadmapId: string) => setPrimaryCareerRoadmapFn({ data: { roadmapId } }),
    onSuccess: invalidateAfterRoadmapChange,
    onError: (error) => showMutationError(error, "Could not switch your primary roadmap."),
  });
  const trackedCareerIds = new Set((careerRoadmaps ?? []).map((r) => r.careerId));
  const addableCareers = (careers ?? []).filter((c) => !trackedCareerIds.has(c.id));

  const gapByName = new Map(workspace.gaps.map((g) => [g.name.toLowerCase(), g]));
  const topicBySkillId = new Map((topicRefs ?? []).map((t) => [t.skillId, t]));
  function topicForSkillName(name: string | null) {
    if (!name) return null;
    const gap = gapByName.get(name.toLowerCase());
    if (!gap) return null;
    return topicBySkillId.get(gap.skillId) ?? null;
  }
  function projectForSkillName(name: string | null) {
    if (!name) return null;
    return (projects ?? []).find((p) =>
      p.skills.some((s) => s.toLowerCase() === name.toLowerCase()),
    );
  }
  /** An assessment can exist for a skill independently of whether that
   * skill has a full learning_topics entry yet (assessments.skill_id is
   * its own direct link, not routed through learning topics) — so a week
   * whose skill has no dedicated lesson can still offer a real "Practice"
   * destination instead of a dead end. */
  function assessmentForSkillName(name: string | null) {
    if (!name) return null;
    const gap = gapByName.get(name.toLowerCase());
    if (!gap) return null;
    return (assessmentsData?.assessments ?? []).find((a) => a.skillId === gap.skillId) ?? null;
  }

  const toggle = useMutation({
    mutationFn: (vars: { taskId: string; completed: boolean }) => setTaskCompletion({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: () => toast.error("Could not update that task."),
  });

  const regenerate = useMutation({
    mutationFn: () => regenerateRoadmap(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Roadmap regenerated from your current skill gap.");
    },
    onError: () => toast.error("Could not regenerate your roadmap."),
  });

  return (
    <AppShell
      title="Your six month roadmap"
      description={roadmap?.summary ?? "Generate a roadmap to see your monthly plan."}
      actions={
        <Button
          variant="outline"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
        >
          Regenerate
        </Button>
      }
    >
      {!roadmap ? (
        <p className="text-muted-foreground text-sm">No roadmap yet.</p>
      ) : (
        <div className="space-y-5">
          {isPro && careerRoadmaps && careerRoadmaps.length > 0 && (
            <Reveal>
              <section className="panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-sm font-semibold">Your career roadmaps</h2>
                  {addableCareers.length > 0 && (
                    <select
                      className="border-border bg-transparent dark:bg-white/[0.04] text-foreground rounded-md border px-2 py-1 text-xs"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) addRoadmap.mutate(e.target.value);
                      }}
                      disabled={addRoadmap.isPending}
                    >
                      <option className="bg-popover text-popover-foreground" value="" disabled>
                        + Add a career roadmap
                      </option>
                      {addableCareers.map((c) => (
                        <option
                          className="bg-popover text-popover-foreground"
                          key={c.id}
                          value={c.id}
                        >
                          {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <ul className="mt-3 space-y-2">
                  {careerRoadmaps.map((r) => (
                    <li
                      key={r.id}
                      className="border-border/60 flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {r.isPrimary && <Star className="text-primary size-3.5 fill-current" />}
                        <span className={r.isPrimary ? "font-medium" : ""}>{r.targetRole}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {r.readinessScore}% ready
                        </Badge>
                      </div>
                      {!r.isPrimary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => switchPrimary.mutate(r.id)}
                          disabled={switchPrimary.isPending}
                        >
                          Make primary
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}
          {!isPro && (
            <div className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-4">
              <p className="text-sm">
                Maintain more than one target role roadmap at once with Pro — e.g. a primary,
                secondary, and future career path, each with its own progress.
              </p>
              <LockedBadge requiredPlan="pro" implemented />
            </div>
          )}

          {roadmap.months.some((m) => m.locked) && (
            <div className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-4">
              <p className="text-sm">
                You're seeing {roadmap.months.filter((m) => !m.locked).length} of{" "}
                {roadmap.totalMonths} months in full detail. Complete each month's tasks to unlock
                the next one, or upgrade to Pro to unlock every month right away.
              </p>
              <LockedBadge requiredPlan="pro" implemented />
            </div>
          )}

          {/* Journey stepper: one node per month, showing completed / active
              / locked / upcoming state so the roadmap reads as a path rather
              than a stack of identical boxes. This is the user's real
              6-month plan (not a generic illustration) — the perspective
              wrapper and alternating depth on each node are a purely visual
              enhancement layered on top of standard, fully accessible HTML;
              every label, link and state below is unchanged by it. */}
          <Reveal>
            <InstrumentFrame
              label="Career path"
              status={`${roadmap.totalMonths} MONTH${roadmap.totalMonths === 1 ? "" : "S"}`}
            >
              <div className="overflow-x-auto p-6 [perspective:1000px]">
                <div className="flex min-w-max items-center [transform-style:preserve-3d]">
                  {roadmap.months.map((month, i) => {
                    const monthDone = !month.locked && month.tasks.every((t) => t.isCompleted);
                    const monthStarted = !month.locked && month.tasks.some((t) => t.isCompleted);
                    const isActive =
                      !month.locked &&
                      !monthDone &&
                      roadmap.months
                        .slice(0, i)
                        .every((m) => m.locked || m.tasks.every((t) => t.isCompleted));
                    const state = month.locked
                      ? "locked"
                      : monthDone
                        ? "done"
                        : isActive
                          ? "active"
                          : "upcoming";
                    return (
                      <div key={month.id} className="flex items-center">
                        <div
                          className="flex flex-col items-center gap-2"
                          style={{ transform: `translateZ(${(i % 2) * 14}px)` }}
                        >
                          <div
                            className={
                              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all " +
                              (state === "done"
                                ? "bg-brand-gradient text-primary-foreground shadow-glow"
                                : state === "active"
                                  ? "bg-primary-soft text-primary animate-pulse-ring ring-primary/40 ring-2"
                                  : state === "locked"
                                    ? "bg-muted text-muted-foreground/60"
                                    : "bg-muted text-muted-foreground")
                            }
                          >
                            {state === "done" ? (
                              <Check className="size-3.5" />
                            ) : state === "locked" ? (
                              <Lock className="size-3.5" />
                            ) : (
                              i + 1
                            )}
                          </div>
                          <span
                            className={
                              "flex min-h-7 max-w-[4.5rem] items-start justify-center text-center text-[11px] leading-tight break-words " +
                              (state === "upcoming" || state === "locked"
                                ? "text-muted-foreground"
                                : "text-foreground font-medium")
                            }
                          >
                            {/* The numbered circle above already shows "1",
                                "2", etc., so the redundant "Month N: "
                                prefix is dropped here to leave room for the
                                theme itself (e.g. "Foundations",
                                "Interview readiness") to actually fit --
                                previously the full "Month 1: Foundations"
                                string was crammed into a single-line
                                `truncate`d 80px box and always rendered as
                                "Month 1: Fou...". The full, untouched title
                                (e.g. "Month 1: Foundations") still appears
                                unabridged in the month heading below. */}
                            {stripMonthNumberPrefix(month.title)}
                          </span>
                        </div>
                        {i < roadmap.months.length - 1 && (
                          <div
                            className={
                              "mx-1.5 mb-5 h-0.5 w-10 rounded-full transition-colors sm:w-16 " +
                              (monthDone || (monthStarted && !isActive)
                                ? "bg-primary"
                                : "bg-border")
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </InstrumentFrame>
          </Reveal>

          {roadmap.months.map((month, monthIndex) =>
            month.locked ? (
              <Reveal key={month.id} delay={Math.min(monthIndex * 40, 200)}>
                <section className="panel border-dashed p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Lock className="text-muted-foreground size-4" />
                      <h2 className="font-display text-muted-foreground text-lg font-semibold">
                        {month.title}
                      </h2>
                    </div>
                    <Badge variant="secondary">{month.estimatedHours} h planned</Badge>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Complete Month {month.monthNumber - 1} to unlock this month's goals, weekly
                    tasks, project, and milestone — or upgrade to Pro to unlock every month right
                    away.
                  </p>
                  <Button asChild size="sm" className="mt-3">
                    <Link to="/pricing">Unlock full roadmap</Link>
                  </Button>
                </section>
              </Reveal>
            ) : (
              <Reveal key={month.id} delay={monthIndex === 0 ? 0 : Math.min(monthIndex * 40, 200)}>
                <section className="panel hover-lift p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold">{month.title}</h2>
                    <Badge variant="secondary">{month.estimatedHours} h planned</Badge>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">{month.goal}</p>
                  {month.topics.length > 0 && (
                    <ul className="text-muted-foreground mt-3 flex flex-wrap gap-2 text-xs">
                      {month.topics.map((topic) => (
                        <li key={topic} className="bg-muted rounded-full px-3 py-1">
                          {topic}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-5 space-y-5">
                    {groupTasksByWeek(month.tasks).map((weekGroup) => (
                      <div key={weekGroup.weekNumber}>
                        <div className="flex items-center justify-between gap-2 px-1">
                          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                            Week {weekGroup.weekNumber}
                          </h3>
                          <Badge variant="outline" className="text-[11px]">
                            {weekGroup.totalHours}h
                          </Badge>
                        </div>
                        <ul className="mt-2 space-y-3">
                          {weekGroup.tasks.map((task) => {
                            const topic = topicForSkillName(task.skillName);
                            const fallbackAssessment = !topic
                              ? assessmentForSkillName(task.skillName)
                              : null;
                            const gap = task.skillName
                              ? gapByName.get(task.skillName.toLowerCase())
                              : null;
                            const project = projectForSkillName(task.skillName);
                            return (
                              <li
                                key={task.id}
                                className="border-border/70 hover:border-primary/30 rounded-xl border p-3 transition-all duration-200 hover:bg-muted/40 hover:shadow-sm"
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    id={task.id}
                                    checked={task.isCompleted}
                                    onCheckedChange={(checked) =>
                                      toggle.mutate({
                                        taskId: task.id,
                                        completed: checked === true,
                                      })
                                    }
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <label htmlFor={task.id} className="cursor-pointer text-sm">
                                      <span
                                        className={
                                          task.isCompleted
                                            ? "line-through opacity-60"
                                            : "font-medium"
                                        }
                                      >
                                        {task.title}
                                      </span>
                                      <span className="text-muted-foreground block text-xs">
                                        {task.description}
                                      </span>
                                    </label>

                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                                      <Badge variant="outline">
                                        {task.estimatedHours}h estimated
                                      </Badge>
                                      {gap && (
                                        <Badge variant="outline">
                                          {PROFICIENCY_LABEL[gap.yourLevel]} →{" "}
                                          {PROFICIENCY_LABEL[gap.requiredLevel]}
                                        </Badge>
                                      )}
                                      {gap && (
                                        <Badge
                                          className={
                                            gap.status === "ready"
                                              ? "bg-success-soft text-success border-none"
                                              : gap.status === "in_progress"
                                                ? "bg-warning-soft text-warning border-none"
                                                : undefined
                                          }
                                          variant={gap.status === "missing" ? "outline" : undefined}
                                        >
                                          {gap.status === "ready"
                                            ? "Ready"
                                            : gap.status === "in_progress"
                                              ? "In progress"
                                              : "Not started"}
                                        </Badge>
                                      )}
                                      {topic && (
                                        <Badge variant="outline" className="capitalize">
                                          {topic.difficulty}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {topic ? (
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Link
                                            to="/learn/$topicSlug"
                                            params={{ topicSlug: topic.slug }}
                                          >
                                            <GraduationCap className="size-3.5" />
                                            {task.isCompleted ? "Review" : "Learn"} {task.skillName}
                                          </Link>
                                        </Button>
                                      ) : task.skillName && fallbackAssessment ? (
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Link to="/assessments">
                                            <ClipboardCheck className="size-3.5" />
                                            Practice {task.skillName}
                                          </Link>
                                        </Button>
                                      ) : task.skillName && project ? (
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Link
                                            to="/projects/$projectId"
                                            params={{ projectId: project.id }}
                                          >
                                            <FolderGit2 className="size-3.5" />
                                            Practice {task.skillName} by building
                                          </Link>
                                        </Button>
                                      ) : task.skillName ? (
                                        <span className="text-muted-foreground text-xs">
                                          We don't have a dedicated lesson for {task.skillName} yet
                                          — it's on our list to add.
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">
                                          This week is a review task — no dedicated lesson needed.
                                        </span>
                                      )}
                                      {topic?.hasAssessment && (
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Link to="/assessments">
                                            <ClipboardCheck className="size-3.5" />
                                            Assessment
                                          </Link>
                                        </Button>
                                      )}
                                      {project && (topic || fallbackAssessment) && (
                                        <Button
                                          asChild
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs"
                                        >
                                          <Link
                                            to="/projects/$projectId"
                                            params={{ projectId: project.id }}
                                          >
                                            <FolderGit2 className="size-3.5" />
                                            Project
                                          </Link>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {month.milestone && (
                    <p className="text-muted-foreground border-border/70 mt-5 border-t pt-4 text-xs">
                      Milestone: {month.milestone}
                    </p>
                  )}
                </section>
              </Reveal>
            ),
          )}
        </div>
      )}
    </AppShell>
  );
}
