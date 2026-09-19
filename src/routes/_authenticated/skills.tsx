import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { AnimatedNumber } from "@/components/app/animated-number";
import { EmptyState } from "@/components/app/empty-state";
import { Reveal } from "@/components/app/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { workspaceQuery } from "@/routes/_authenticated/dashboard";
import { IMPORTANCE_LABEL, PROFICIENCY_LABEL, skillGapReason } from "@/lib/domain";
import { getLearningTopicRefs } from "@/lib/learning.functions";
import { getProjects } from "@/lib/projects.functions";
import { getAssessments } from "@/lib/assessments.functions";
import { getAdvancedSkillGap } from "@/lib/skill-gap.functions";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  FolderGit2,
  GraduationCap,
  ListOrdered,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { LockedBadge } from "@/components/app/upgrade-prompt";
import { FEATURE_INFO } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/skills")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQuery),
  head: () => ({
    meta: [{ title: "Skill gap — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="skills"
      title="Skill gap unavailable"
      description="Please refresh to try again."
    />
  ),
  component: SkillsPage,
});

function SkillsPage() {
  const { data } = useSuspenseQuery(workspaceQuery);
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
  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });
  const isPro = subscription?.features.advanced_skill_gap === true;
  const { data: advanced } = useQuery({
    queryKey: ["advanced-skill-gap"],
    queryFn: () => getAdvancedSkillGap(),
    enabled: isPro,
  });
  const topicBySkillId = new Map((topicRefs ?? []).map((t) => [t.skillId, t]));
  const advancedBySkillId = new Map((advanced?.rows ?? []).map((r) => [r.skillId, r]));

  const readyCount = data.gaps.filter((g) => g.status === "ready").length;
  const missingCount = data.gaps.filter((g) => g.status === "missing").length;

  return (
    <AppShell
      title="Skill gap analysis"
      description={`Every requirement for ${data.profile.targetRole ?? "your target role"}, with the exact gap and how it is weighted. Click a skill to start learning it.`}
    >
      {subscription && !isPro && (
        <div className="border-border/70 bg-muted/30 mb-4 flex items-center justify-between gap-3 rounded-xl border p-4">
          <p className="text-sm">
            This is your basic skill gap analysis. Priority ranking, prerequisites, a recommended
            learning sequence, and live job demand signals are available with Pro.
          </p>
          <LockedBadge
            requiredPlan="pro"
            implemented={FEATURE_INFO.advanced_skill_gap.implemented}
          />
        </div>
      )}

      {isPro && advanced && advanced.recommendedSequence.length > 0 && (
        <Reveal>
          <div className="panel mb-5 p-5">
            <div className="flex items-center gap-2">
              <ListOrdered className="text-primary size-4" />
              <h3 className="font-display text-sm font-semibold">Recommended learning sequence</h3>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Highest-priority gaps first, weighted by how critical each skill is to{" "}
              {data.profile.targetRole ?? "your target role"} and how far you are from it.
              {(() => {
                const totalHours = advanced.rows
                  .filter((r) => advanced.recommendedSequence.includes(r.name))
                  .reduce((sum, r) => sum + (r.estimatedHours ?? 0), 0);
                return totalHours > 0
                  ? ` About ${Math.round(totalHours)}h of learning content mapped so far.`
                  : "";
              })()}
            </p>
            <ol className="mt-3 flex flex-wrap gap-2 text-sm">
              {advanced.recommendedSequence.map((name, i) => (
                <li
                  key={name}
                  className="bg-muted/50 flex items-center gap-1.5 rounded-full px-3 py-1"
                >
                  <span className="text-muted-foreground text-xs font-semibold">{i + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
              <TrendingUp className="size-3.5" />
              {advanced.liveJobSignal.available
                ? `Job-demand percentages below are calculated from ${advanced.liveJobSignal.jobsAnalyzed} real, currently-ingested job postings for this role.`
                : "Demand percentages below use each skill's curated career profile until enough live job postings are ingested for this role."}
            </p>
          </div>
        </Reveal>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Reveal>
          <div className="panel hover-lift p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Total skills tracked
            </p>
            <p className="font-display mt-1 text-2xl font-semibold">
              <AnimatedNumber value={data.gaps.length} />
            </p>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <div className="panel hover-lift p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Ready
            </p>
            <p className="font-display text-success mt-1 text-2xl font-semibold">
              <AnimatedNumber value={readyCount} />
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="panel hover-lift p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Not started
            </p>
            <p className="font-display text-warning mt-1 text-2xl font-semibold">
              <AnimatedNumber value={missingCount} />
            </p>
          </div>
        </Reveal>
      </div>

      {data.gaps.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={`You're covering every skill ${data.profile.targetRole ? `${data.profile.targetRole} needs` : "your target role needs"}`}
          description="No open gaps to show here right now. If that looks wrong, double check your target role in Settings — this list is scoped to whatever role is currently selected."
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">Check target role</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.gaps.map((gap, gapIndex) => {
            const topic = topicBySkillId.get(gap.skillId);
            const matchedProject = (projects ?? []).find((p) =>
              p.skills.some((s) => s.toLowerCase() === gap.name.toLowerCase()),
            );
            // Assessments link directly to a skill (assessments.skill_id), so a
            // skill without a dedicated learning topic yet can still offer a
            // real "Practice" destination instead of a disabled dead end.
            const fallbackAssessment = !topic
              ? ((assessmentsData?.assessments ?? []).find((a) => a.skillId === gap.skillId) ??
                null)
              : null;
            const coveragePercent = Math.max(0, Math.min(100, 100 - gap.gapPercentage));
            const adv = isPro ? advancedBySkillId.get(gap.skillId) : undefined;

            return (
              <Reveal key={gap.skillId} delay={Math.min(gapIndex * 40, 240)} className="h-full">
                <article className="panel group hover-lift relative flex h-full flex-col overflow-hidden p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {adv?.priorityRank != null && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Sparkles className="size-3" />#{adv.priorityRank}
                          </Badge>
                        )}
                        <h3 className="font-display text-base font-semibold">{gap.name}</h3>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {IMPORTANCE_LABEL[gap.importance]} priority
                        {gap.demandPercentage != null
                          ? ` · in ${gap.demandPercentage}% of postings`
                          : ""}
                      </p>
                    </div>
                    <Badge
                      className={
                        gap.status === "ready"
                          ? "bg-success-soft text-success border-none"
                          : gap.status === "in_progress"
                            ? "bg-warning-soft text-warning border-none"
                            : "bg-destructive/10 text-destructive border-none"
                      }
                    >
                      {gap.status === "ready"
                        ? "Ready"
                        : gap.status === "in_progress"
                          ? "In progress"
                          : "Missing"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {PROFICIENCY_LABEL[gap.yourLevel]} → {PROFICIENCY_LABEL[gap.requiredLevel]}
                    </span>
                    <span className="font-medium tabular-nums">{coveragePercent}%</span>
                  </div>
                  <Progress value={coveragePercent} className="mt-1.5" />

                  {topic ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="capitalize">
                        {topic.difficulty}
                      </Badge>
                      <Badge variant="outline">{topic.estimatedHours}h</Badge>
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-xs">
                      We don't yet have a dedicated learning topic mapped to this exact skill — it's
                      on our list to add.
                    </p>
                  )}

                  {adv && (
                    <div className="border-border/60 mt-3 space-y-1.5 border-t pt-3 text-xs">
                      {adv.prerequisites.length > 0 && (
                        <p className="text-muted-foreground">
                          <span className="font-medium">Prerequisites:</span>{" "}
                          {adv.prerequisites.join(", ")}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        <span className="font-medium">Why:</span>{" "}
                        {skillGapReason({
                          importance: gap.importance,
                          status: gap.status,
                          liveJobDemandPercentage: adv.liveJobDemandPercentage,
                          demandPercentage: gap.demandPercentage,
                          prerequisites: adv.prerequisites,
                          targetRole: data.profile.targetRole,
                        })}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {topic ? (
                      <Button asChild size="sm">
                        <Link to="/learn/$topicSlug" params={{ topicSlug: topic.slug }}>
                          <GraduationCap className="size-3.5" />
                          {gap.status === "ready" ? "Review" : "Start learning"}
                        </Link>
                      </Button>
                    ) : fallbackAssessment ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/assessments">
                          <ClipboardCheck className="size-3.5" />
                          Practice this skill
                        </Link>
                      </Button>
                    ) : matchedProject ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/projects/$projectId" params={{ projectId: matchedProject.id }}>
                          <FolderGit2 className="size-3.5" />
                          Practice by building
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        <GraduationCap className="size-3.5" />
                        No lesson yet
                      </Button>
                    )}
                    {topic?.hasAssessment && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/assessments">
                          <ClipboardCheck className="size-3.5" />
                          Assessment
                        </Link>
                      </Button>
                    )}
                    {matchedProject && (topic || fallbackAssessment) && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/projects/$projectId" params={{ projectId: matchedProject.id }}>
                          <FolderGit2 className="size-3.5" />
                          Project
                          <ArrowUpRight className="size-3 opacity-60" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
