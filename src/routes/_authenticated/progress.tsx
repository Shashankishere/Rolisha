import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  CheckCircle2,
  FolderGit2,
  ListTree,
  Map as MapIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { ReadinessRing } from "@/components/dashboard/readiness-ring";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getWorkspace } from "@/lib/me.functions";
import { getCareerAnalytics } from "@/lib/analytics.functions";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { LockedBadge } from "@/components/app/upgrade-prompt";
import type { ProgressEventView } from "@/lib/me-types";
import { cn } from "@/lib/utils";

const workspaceQuery = queryOptions({ queryKey: ["workspace"], queryFn: () => getWorkspace() });

const EVENT_META: Record<string, { label: string; icon: typeof CheckCircle2 }> = {
  roadmap_generated: { label: "Roadmap generated", icon: MapIcon },
  task_completed: { label: "Task completed", icon: CheckCircle2 },
  skill_added_to_roadmap: { label: "Skill added to roadmap", icon: ListTree },
  project_started: { label: "Project started", icon: FolderGit2 },
  project_completed: { label: "Project completed", icon: FolderGit2 },
};

function relativeFromNow(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

export const Route = createFileRoute("/_authenticated/progress")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQuery),
  head: () => ({
    meta: [{ title: "Progress — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="progress"
      title="Progress unavailable"
      description="Please refresh to try again."
    />
  ),
  component: ProgressPage,
});

function ProgressPage() {
  const { data: workspace } = useSuspenseQuery(workspaceQuery);
  const { readiness, events, roadmap } = workspace;

  const tasksCompleted = events.filter((e) => e.eventType === "task_completed").length;
  const projectsCompleted = events.filter((e) => e.eventType === "project_completed").length;
  const skillsAdded = events.filter((e) => e.eventType === "skill_added_to_roadmap").length;

  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });
  const isPro = subscription?.features.career_analytics === true;
  const { data: analytics } = useQuery({
    queryKey: ["career-analytics"],
    queryFn: () => getCareerAnalytics(),
    enabled: isPro,
  });

  return (
    <AppShell
      title="Progress"
      description="Your readiness score and a real record of what you've completed — not a leaderboard, just your own history."
    >
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <div className="panel flex flex-col items-center justify-center gap-3 p-8">
          <ReadinessRing value={readiness} size={140} />
          <p className="text-muted-foreground text-center text-sm">
            {roadmap
              ? `Toward ${roadmap.targetRole}`
              : "Complete onboarding to see your target role"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={MapIcon} label="Tasks completed" value={tasksCompleted} />
          <StatCard icon={FolderGit2} label="Projects completed" value={projectsCompleted} />
          <StatCard icon={Sparkles} label="Skills added" value={skillsAdded} />
        </div>
      </div>

      {isPro ? (
        analytics && <CareerAnalyticsSection analytics={analytics} />
      ) : (
        <div className="border-border/70 bg-muted/30 mt-5 flex items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-sm">
            Deeper analytics — roadmap completion, strongest/weakest skills, assessment performance,
            and a readiness trend over time — are available with Pro.
          </p>
          <LockedBadge requiredPlan="pro" implemented />
        </div>
      )}

      <section className="panel mt-5 p-6">
        <h2 className="font-display text-lg font-semibold">Recent activity</h2>
        {events.length === 0 ? (
          <div className="mt-6 text-center">
            <ListTree className="text-muted-foreground mx-auto size-8" />
            <p className="mt-3 text-sm font-medium">Nothing here yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Complete a roadmap task, start a project, or add a skill and it'll show up here.
            </p>
          </div>
        ) : (
          <ol className="mt-5 space-y-4">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ol>
        )}
      </section>
    </AppShell>
  );
}

const trendChartConfig = {
  readinessScore: { label: "Readiness", color: "var(--primary)" },
} satisfies ChartConfig;

function CareerAnalyticsSection({
  analytics,
}: {
  analytics: import("@/lib/analytics.server").CareerAnalytics;
}) {
  return (
    <section className="panel mt-5 p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="text-primary size-4" />
        <h2 className="font-display text-lg font-semibold">Career analytics</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat
          label="Roadmap complete"
          value={
            analytics.roadmapCompletionPercent != null
              ? `${analytics.roadmapCompletionPercent}%`
              : "—"
          }
        />
        <MiniStat
          label="Skills ready"
          value={`${analytics.skillsReadyCount}/${analytics.skillsRequiredCount}`}
        />
        <MiniStat label="Learning hours" value={`${analytics.learningHoursCompleted}h`} />
        <MiniStat label="Projects done" value={String(analytics.projectsCompletedCount)} />
      </div>

      {analytics.assessments.assessmentsTaken > 0 && (
        <div className="border-border/60 mt-5 border-t pt-4">
          <h3 className="text-sm font-semibold">Assessment performance</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {analytics.assessments.assessmentsPassed} of {analytics.assessments.assessmentsTaken}{" "}
            assessments passed
            {analytics.assessments.averageBestScore != null
              ? `, averaging ${analytics.assessments.averageBestScore}%`
              : ""}
            .
          </p>
        </div>
      )}

      {(analytics.strongestSkills.length > 0 || analytics.weakestSkills.length > 0) && (
        <div className="border-border/60 mt-5 grid gap-5 border-t pt-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Strongest skills</h3>
            <ul className="mt-2 space-y-2">
              {analytics.strongestSkills.map((s) => (
                <li key={s.skillId} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate">{s.name}</span>
                  <Progress value={s.coveragePercent} className="h-1.5 flex-1" />
                  <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                    {s.coveragePercent}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Weakest skills</h3>
            <ul className="mt-2 space-y-2">
              {analytics.weakestSkills.map((s) => (
                <li key={s.skillId} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate">{s.name}</span>
                  <Progress value={s.coveragePercent} className="h-1.5 flex-1" />
                  <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                    {s.coveragePercent}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="border-border/60 mt-5 border-t pt-4">
        <h3 className="text-sm font-semibold">Readiness trend</h3>
        {analytics.readinessTrend.length >= 2 ? (
          <ChartContainer config={trendChartConfig} className="mt-3 h-48 w-full">
            <LineChart data={analytics.readinessTrend}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                }
                tickLine={false}
                axisLine={false}
              />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={30} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="readinessScore"
                stroke="var(--color-readinessScore)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Keep learning to unlock your readiness trend.
          </p>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <div className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-full">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ProgressEventView }) {
  const meta = EVENT_META[event.eventType] ?? { label: event.eventType, icon: CheckCircle2 };
  const Icon = meta.icon;
  const isCompletion =
    event.eventType === "task_completed" || event.eventType === "project_completed";
  return (
    <li className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
          isCompletion ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{meta.label}</p>
        {event.label && <p className="text-muted-foreground truncate text-sm">{event.label}</p>}
      </div>
      <span className="text-muted-foreground shrink-0 text-xs">
        {relativeFromNow(event.createdAt)}
      </span>
    </li>
  );
}
