import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Briefcase,
  ClipboardCheck,
  FolderGit2,
  GraduationCap,
  Lightbulb,
  Rocket,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { TiltCard } from "@/components/app/tilt-card";
import { ReadinessRing } from "@/components/dashboard/readiness-ring";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { SkillConstellation } from "@/components/dashboard/skill-constellation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/job-card";
import { getWorkspace } from "@/lib/me.functions";
import { listJobs, saveJob, unsaveJob } from "@/lib/jobs.functions";
import { getAssessments } from "@/lib/assessments.functions";
import { getProjects } from "@/lib/projects.functions";
import { getLearningTopicRefs } from "@/lib/learning.functions";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { SubscriptionMiniCard } from "@/components/app/subscription-panel";
import {
  IMPORTANCE_LABEL,
  PROFICIENCY_LABEL,
  greeting,
  readinessStatusMessage,
  readinessTiers,
} from "@/lib/domain";
import type { JobListItem } from "@/lib/jobs/explorer-types";

export const workspaceQuery = queryOptions({
  queryKey: ["workspace"],
  queryFn: () => getWorkspace(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async ({ context }) => {
    const workspace = await context.queryClient.ensureQueryData(workspaceQuery);
    if (!workspace.profile.onboardingCompleted) throw redirect({ to: "/onboarding" });
    return workspace;
  },
  head: () => ({
    meta: [{ title: "Dashboard — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="dashboard"
      title="Dashboard unavailable"
      description="We could not load your workspace. Please refresh."
    />
  ),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(workspaceQuery);
  const { profile, gaps, readiness, roadmap } = data;
  const role = profile.targetRole ?? "your target role";
  const tasks = roadmap?.months.flatMap((m) => m.tasks) ?? [];
  const done = tasks.filter((t) => t.isCompleted).length;
  const nextTasks = tasks.filter((t) => !t.isCompleted).slice(0, 4);
  const priorityGaps = [...gaps].filter((g) => g.gapPercentage > 0).slice(0, 5);
  const queryClient = useQueryClient();

  const targetJobsQuery = useQuery({
    queryKey: ["dashboard-target-jobs", profile.careerId],
    queryFn: () =>
      listJobs({
        data: { careerId: profile.careerId, sort: "best_match", page: 1, pageSize: 3 },
      }),
  });

  const assessmentsQuery = useQuery({
    queryKey: ["assessments"],
    queryFn: () => getAssessments(),
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });

  const topicRefsQuery = useQuery({
    queryKey: ["learning-topic-refs"],
    queryFn: () => getLearningTopicRefs(),
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });

  const saveMutation = useMutation({
    mutationFn: (job: JobListItem) =>
      job.isSaved ? unsaveJob({ data: { jobId: job.id } }) : saveJob({ data: { jobId: job.id } }),
    onSuccess: (_result, job) => {
      toast.success(job.isSaved ? "Removed from saved jobs." : "Job saved.");
      queryClient.invalidateQueries({ queryKey: ["dashboard-target-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: () => toast.error("Could not update this job."),
  });

  const targetJobs = targetJobsQuery.data?.jobs ?? [];
  const almostQualifiedJobs = targetJobs.filter(
    (j) => j.match && j.match.overall >= 65 && j.match.overall < 95 && j.missingSkills.length > 0,
  );

  const topGap = priorityGaps[0] ?? null;
  const topGapTopic = topGap
    ? (topicRefsQuery.data ?? []).find((t) => t.skillId === topGap.skillId)
    : null;

  const assessments = assessmentsQuery.data?.assessments ?? [];
  const attemptedAssessments = assessments
    .filter((a) => a.lastAttemptAt)
    .sort((a, b) => (b.lastAttemptAt! > a.lastAttemptAt! ? 1 : -1));
  const latestAssessment = attemptedAssessments[0] ?? null;
  const recommendedAssessment =
    assessments.find((a) => a.isRoleMatch && !a.passed) ??
    assessments.find((a) => !a.passed) ??
    null;

  const projects = projectsQuery.data ?? [];
  const currentProject =
    projects.find((p) => p.status === "started") ??
    projects.find((p) => p.isRecommended && p.status === "not_started") ??
    null;
  const completedProjectsCount = projects.filter((p) => p.status === "completed").length;

  const hasAnyProgress =
    tasks.some((t) => t.isCompleted) ||
    attemptedAssessments.length > 0 ||
    completedProjectsCount > 0;

  return (
    <AppShell
      title={`${greeting()}${profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}`}
      description={`Your progress towards ${role}.`}
      actions={
        <Button asChild>
          <Link to="/roadmap">Open roadmap</Link>
        </Button>
      }
    >
      <Reveal>
        <TiltCard maxTilt={2} className="w-full">
          <div className="panel hover-lift bg-halo shadow-glow relative flex w-full flex-col gap-6 overflow-hidden p-7 sm:flex-row sm:items-center sm:p-9">
            <div
              className="via-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent to-transparent"
              aria-hidden
            />
            <div className="relative shrink-0">
              <ReadinessRing value={readiness} size={148} instrument />
            </div>
            <div className="relative min-w-0">
              <p className="text-primary text-xs font-semibold tracking-widest uppercase">
                Job readiness
              </p>
              <p className="font-display mt-1 text-2xl font-semibold sm:text-3xl">{role}</p>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                {readinessStatusMessage(readiness)}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                Importance-weighted coverage of {gaps.length} required skills.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/roadmap">
                    <Rocket className="size-3.5" />
                    Continue roadmap
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/skills">
                    <Target className="size-3.5" />
                    Explore skill gaps
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </TiltCard>
      </Reveal>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Reveal delay={80}>
          <TiltCard maxTilt={3} className="h-full">
            <div className="panel hover-lift flex h-full flex-col p-6">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Weekly plan
              </p>
              <p className="font-display mt-1 text-3xl font-semibold">
                <AnimatedNumber value={done} />/{tasks.length}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">tasks completed in your roadmap.</p>
              <div className="mt-auto pt-3">
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-brand-gradient animate-progress-fill h-full rounded-full"
                    style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </TiltCard>
        </Reveal>

        <Reveal delay={160}>
          <TiltCard maxTilt={3} className="h-full">
            <div className="panel hover-lift h-full p-6">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Seniority readiness
              </p>
              <ul className="mt-3 space-y-2">
                {readinessTiers(role, readiness).map((tier) => (
                  <li key={tier.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{tier.label}</span>
                    <Badge
                      className={
                        tier.tier === "ready"
                          ? "bg-success-soft text-success border-none"
                          : tier.tier === "almost"
                            ? "bg-warning-soft text-warning border-none"
                            : undefined
                      }
                      variant={tier.tier === "not_yet" ? "outline" : undefined}
                    >
                      {tier.tier === "ready"
                        ? "Ready"
                        : tier.tier === "almost"
                          ? "Almost"
                          : "Not yet"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </TiltCard>
        </Reveal>
      </div>

      <Reveal>
        <section aria-labelledby="career-progress-heading" className="mt-5">
          <h2 id="career-progress-heading" className="sr-only">
            Career progress
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  label: "Roadmap",
                  done,
                  total: tasks.length,
                  unit: "tasks",
                  href: "/roadmap" as const,
                  icon: Rocket,
                },
                {
                  label: "Skills",
                  done: gaps.filter((g) => g.status === "ready").length,
                  total: gaps.length,
                  unit: "ready",
                  href: "/skills" as const,
                  icon: Target,
                },
                {
                  label: "Projects",
                  done: completedProjectsCount,
                  total: projects.length,
                  unit: "completed",
                  href: "/projects" as const,
                  icon: FolderGit2,
                },
                {
                  label: "Assessments",
                  done: assessments.filter((a) => a.passed).length,
                  total: assessments.length,
                  unit: "passed",
                  href: "/assessments" as const,
                  icon: ClipboardCheck,
                },
              ] as const
            ).map((metric, i) => {
              const percent = metric.total > 0 ? Math.round((metric.done / metric.total) * 100) : 0;
              return (
                <Reveal key={metric.label} delay={i * 40} className="h-full">
                  <Link
                    to={metric.href}
                    className="panel hover-lift focus-visible:ring-ring group flex h-full flex-col p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {metric.label}
                      </p>
                      <span className="bg-primary-soft text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors">
                        <metric.icon className="size-4" />
                      </span>
                    </div>
                    <p className="font-display mt-2 text-2xl font-semibold tabular-nums">
                      <AnimatedNumber value={metric.done} />
                      <span className="text-muted-foreground text-base font-normal">
                        /{metric.total}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{metric.unit}</p>
                    <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-brand-gradient animate-progress-fill h-full rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      </Reveal>

      <Reveal delay={40}>
        <section aria-labelledby="quick-actions-heading" className="mt-5">
          <h2 id="quick-actions-heading" className="text-base font-semibold">
            Quick actions
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Continue roadmap", icon: Rocket, href: "/roadmap" as const },
              { label: "Learn a skill", icon: GraduationCap, href: "/skills" as const },
              { label: "Build a project", icon: FolderGit2, href: "/projects" as const },
              { label: "Take an assessment", icon: ClipboardCheck, href: "/assessments" as const },
              { label: "Explore jobs", icon: Briefcase, href: "/jobs" as const },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="panel hover-lift focus-visible:ring-ring flex flex-col items-center gap-2 p-4 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-primary-soft text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <action.icon className="size-4.5" />
                </span>
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      {subscriptionQuery.data && (
        <Reveal delay={200}>
          <div className="mt-5 max-w-sm">
            <SubscriptionMiniCard status={subscriptionQuery.data} />
          </div>
        </Reveal>
      )}

      {!hasAnyProgress && (
        <Reveal>
          <div className="panel border-primary/20 hover-lift mt-5 p-6">
            <p className="text-sm font-medium">
              Complete your first assessment to start tracking your readiness.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Your readiness score, skill levels and recommendations all sharpen as you complete
              assessments, tasks and projects.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/assessments">Take an assessment</Link>
            </Button>
          </div>
        </Reveal>
      )}

      {topGap && (
        <Reveal>
          <section className="panel border-primary/20 hover-lift bg-halo mt-5 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="bg-primary-soft text-primary animate-pulse-ring inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Lightbulb className="size-4.5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Recommended next step
                </p>
                <p className="font-display mt-0.5 text-base font-semibold">
                  Improve {topGap.name} fundamentals
                </p>
                <p className="text-muted-foreground mt-1 max-w-lg text-sm">
                  {topGap.name} is {IMPORTANCE_LABEL[topGap.importance].toLowerCase()} for {role}{" "}
                  and your current level ({PROFICIENCY_LABEL[topGap.yourLevel]}) is below the
                  required level ({PROFICIENCY_LABEL[topGap.requiredLevel]}).
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                {topGapTopic ? (
                  <Link to="/learn/$topicSlug" params={{ topicSlug: topGapTopic.slug }}>
                    Learn {topGap.name}
                  </Link>
                ) : (
                  <Link to="/skills">Learn {topGap.name}</Link>
                )}
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/assessments">Take assessment</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/projects">Build project</Link>
              </Button>
            </div>
          </section>
        </Reveal>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <SkillConstellation gaps={gaps} />
        </Reveal>

        <Reveal delay={60}>
          <section className="panel hover-lift flex h-full flex-col p-6">
            <h2 className="text-base font-semibold">Priority skill gaps</h2>
            <div className="flex-1">
              <ul className="mt-4 space-y-3">
                {priorityGaps.length === 0 && (
                  <li className="text-muted-foreground text-sm">
                    No gaps left in this profile — nice work.
                  </li>
                )}
                {priorityGaps.map((gap) => (
                  <li key={gap.skillId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{gap.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {IMPORTANCE_LABEL[gap.importance]} · you: {PROFICIENCY_LABEL[gap.yourLevel]}{" "}
                        · needed: {PROFICIENCY_LABEL[gap.requiredLevel]}
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {gap.gapPercentage}% gap
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-5 self-start">
              <Link to="/skills">See full matrix</Link>
            </Button>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="panel hover-lift flex h-full flex-col p-6">
            <h2 className="text-base font-semibold">Next up</h2>
            <div className="flex-1">
              <ul className="mt-4 space-y-3">
                {nextTasks.length === 0 && (
                  <li className="text-muted-foreground text-sm">Every task is complete.</li>
                )}
                {nextTasks.map((task) => (
                  <li key={task.id} className="text-sm">
                    <span className="font-medium">Week {task.weekNumber}:</span> {task.title}
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-5 self-start">
              <Link to="/roadmap">Go to weekly plan</Link>
            </Button>
          </section>
        </Reveal>
      </div>

      {/* Equal-height responsive grid: each card is a full-height flex
          column so the CTA button always sits at the same bottom edge
          regardless of how much status content the card has above it. */}
      <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-2">
        <Reveal>
          <section className="panel hover-lift flex h-full flex-col p-6">
            <div className="flex items-center gap-2">
              <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <ClipboardCheck className="size-4" />
              </span>
              <h2 className="text-base font-semibold">Assessments</h2>
            </div>
            <div className="flex-1">
              {latestAssessment ? (
                <div className="mt-4">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Latest attempt
                  </p>
                  <p className="mt-1 text-sm font-medium">{latestAssessment.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Score: {latestAssessment.bestScore}% ·{" "}
                    {latestAssessment.passed ? "Passed" : "Not yet passing"}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground mt-4 text-sm">
                  You haven't attempted an assessment yet.
                </p>
              )}
              {recommendedAssessment && (
                <p className="text-muted-foreground mt-3 text-sm">
                  Recommended next:{" "}
                  <span className="font-medium">{recommendedAssessment.title}</span>
                </p>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="mt-5 self-start">
              <Link to="/assessments">Go to assessments</Link>
            </Button>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="panel hover-lift flex h-full flex-col p-6">
            <div className="flex items-center gap-2">
              <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <FolderGit2 className="size-4" />
              </span>
              <h2 className="text-base font-semibold">Projects</h2>
            </div>
            <div className="flex-1">
              {currentProject ? (
                <div className="mt-4">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {currentProject.status === "started" ? "In progress" : "Suggested for you"}
                  </p>
                  <p className="mt-1 text-sm font-medium">{currentProject.title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {currentProject.difficulty} · {currentProject.estimatedHours}h estimated
                  </p>
                  {currentProject.status === "started" && currentProject.totalTaskCount > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {currentProject.completedTaskCount} of {currentProject.totalTaskCount} steps
                      done
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground mt-4 text-sm">No project in progress yet.</p>
              )}
              <p className="text-muted-foreground mt-3 text-sm">
                {completedProjectsCount} project{completedProjectsCount === 1 ? "" : "s"} completed.
              </p>
            </div>
            {currentProject ? (
              <Button asChild size="sm" className="mt-5 self-start">
                <Link to="/projects/$projectId" params={{ projectId: currentProject.id }}>
                  Continue project
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="mt-5 self-start">
                <Link to="/projects">Browse projects</Link>
              </Button>
            )}
          </section>
        </Reveal>
      </div>

      {targetJobs.length > 0 && (
        <Reveal>
          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Jobs you can target</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/jobs">
                  View all jobs <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {targetJobs.map((job, i) => (
                <Reveal key={job.id} delay={i * 60}>
                  <JobCard
                    job={job}
                    isSaving={saveMutation.isPending}
                    onToggleSave={(j) => saveMutation.mutate(j)}
                  />
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {almostQualifiedJobs.length > 0 && (
        <Reveal>
          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Almost Qualified</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/jobs">
                  View all jobs <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              A few roles where you&apos;re close on skills — open Jobs to see the full breakdown.
            </p>
          </section>
        </Reveal>
      )}
    </AppShell>
  );
}
