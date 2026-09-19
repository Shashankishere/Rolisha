import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Repeat } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt, showMutationError } from "@/components/app/upgrade-prompt";
import { AiStatusNotice } from "@/components/app/premium/ai-status-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO } from "@/lib/subscription";
import { analyzeCareerSwitch } from "@/lib/premium/career-switch.functions";
import type { CareerSwitchAnalysisRow } from "@/lib/premium/career-switch.server";

export const Route = createFileRoute("/_authenticated/premium/career-switch")({
  head: () => ({
    meta: [{ title: "Career Switch Analysis — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-career-switch"
      title="Career switch analysis unavailable"
      description="Please refresh to try again."
    />
  ),
  component: Page,
});

function Page() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });

  if (isLoading) {
    return (
      <AppShell title="Career switch analysis" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.career_switch_analysis) {
    return (
      <AppShell title="Career switch analysis" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <UpgradePrompt
          feature="career_switch_analysis"
          label={FEATURE_INFO.career_switch_analysis.label}
          description={FEATURE_INFO.career_switch_analysis.description}
          currentPlan={subscription.plan}
          requiredPlan="pro"
          implemented
        />
      </AppShell>
    );
  }

  return <Workspace />;
}

function Workspace() {
  const [currentRole, setCurrentRole] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState<CareerSwitchAnalysisRow | null>(null);

  const mutation = useMutation({
    mutationFn: () => analyzeCareerSwitch({ data: { currentRole, targetRole } }),
    onSuccess: setResult,
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not run this analysis."),
  });

  const canSubmit = currentRole.trim().length >= 2 && targetRole.trim().length >= 2;

  return (
    <AppShell
      title="Career switch analysis"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description="A transition plan, not a promise — no guaranteed timeline or outcome."
    >
      <Reveal>
        <div className="panel grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="current-role">Current role / background</Label>
            <Input
              id="current-role"
              className="mt-1.5"
              placeholder="e.g. High school teacher"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="switch-target-role">Target role</Label>
            <Input
              id="switch-target-role"
              className="mt-1.5"
              placeholder="e.g. UX Researcher"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Analyze
          </Button>
        </div>
      </Reveal>

      <div className="mt-6 space-y-4">
        {mutation.isPending && <AiStatusNotice status="pending" />}
        {!mutation.isPending && result?.status === "failed" && (
          <AiStatusNotice
            status="failed"
            errorMessage={result.errorMessage}
            onRetry={() => mutation.mutate()}
          />
        )}
        {!mutation.isPending && result?.status === "completed" && <SwitchResult result={result} />}
        {!mutation.isPending && !result && (
          <EmptyState
            icon={Repeat}
            title="No analysis yet"
            description="Describe your current background and target role above."
          />
        )}
      </div>
    </AppShell>
  );
}

function SwitchResult({ result }: { result: CareerSwitchAnalysisRow }) {
  return (
    <Reveal className="space-y-4">
      {result.summary && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Summary</h3>
          <p className="text-muted-foreground mt-1 text-sm">{result.summary}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel flex h-full flex-col p-5">
          <h3 className="text-sm font-semibold">Transferable skills</h3>
          <ul className="mt-2 space-y-2">
            {result.transferableSkills.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{s.skill}</span>
                <span className="text-muted-foreground"> — {s.howItTransfers}</span>
              </li>
            ))}
          </ul>
        </div>
        <SimplePanel title="Missing skills" items={result.missingSkills} />
        <SimplePanel title="Experience gaps" items={result.experienceGaps} />
        <SimplePanel title="Project gaps" items={result.projectGaps} />
        <SimplePanel title="Learning requirements" items={result.learningRequirements} />
        <SimplePanel title="Job readiness gaps" items={result.jobReadinessGaps} />
      </div>
      {result.estimatedRoadmap.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Estimated transition roadmap</h3>
          <ol className="mt-3 space-y-3">
            {result.estimatedRoadmap.map((phase, i) => (
              <li key={i} className="flex gap-3">
                <span className="bg-primary-soft text-primary grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{phase.phase}</p>
                  <p className="text-muted-foreground text-sm">{phase.focus}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {result.recommendedProjects.length > 0 && (
        <div className="panel p-5">
          <h3 className="text-sm font-semibold">Recommended projects</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
            {result.recommendedProjects.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </Reveal>
  );
}

function SimplePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel flex h-full flex-col p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">None identified.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
