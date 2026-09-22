import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt, showMutationError } from "@/components/app/upgrade-prompt";
import { AiStatusNotice } from "@/components/app/premium/ai-status-notice";
import { Button } from "@/components/ui/button";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO } from "@/lib/subscription";
import { generateCareerRecommendations } from "@/lib/premium/career-recommendations.functions";
import type { CareerRecommendationsRow } from "@/lib/premium/career-recommendations.server";

export const Route = createFileRoute("/_authenticated/premium/career-recommendations")({
  head: () => ({
    meta: [
      { title: "AI Career Recommendations — Rolisha" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-career-recommendations"
      title="Career recommendations unavailable"
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
      <AppShell
        title="AI career recommendations"
        breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.ai_career_recommendations) {
    return (
      <AppShell
        title="AI career recommendations"
        breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      >
        <UpgradePrompt
          feature="ai_career_recommendations"
          label={FEATURE_INFO.ai_career_recommendations.label}
          description={FEATURE_INFO.ai_career_recommendations.description}
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
  const [result, setResult] = useState<CareerRecommendationsRow | null>(null);

  const mutation = useMutation({
    mutationFn: () => generateCareerRecommendations(),
    onSuccess: setResult,
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not generate recommendations."),
  });

  return (
    <AppShell
      title="AI career recommendations"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description="Based on your real profile — education, skills, projects, and preferences."
    >
      <div className="mb-6">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Generate recommendations
        </Button>
      </div>

      {mutation.isPending && <AiStatusNotice status="pending" />}
      {!mutation.isPending && result?.status === "failed" && (
        <AiStatusNotice
          status="failed"
          errorMessage={result.errorMessage}
          onRetry={() => mutation.mutate()}
        />
      )}
      {!mutation.isPending && result?.status === "completed" && (
        <Reveal className="grid gap-4 sm:grid-cols-2">
          {result.recommendedRoles.map((rec, i) => (
            <div key={i} className="panel flex h-full flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <div className="bg-primary-soft text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="font-display text-base font-semibold">{rec.role}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{rec.fitReason}</p>
              <div className="mt-auto space-y-2 text-sm">
                {rec.missingSkills.length > 0 && (
                  <p>
                    <span className="font-medium">Missing skills: </span>
                    {rec.missingSkills.join(", ")}
                  </p>
                )}
                {rec.nextSteps.length > 0 && (
                  <div>
                    <span className="font-medium">Next steps:</span>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {rec.nextSteps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rec.roadmapDirection && (
                  <p>
                    <span className="font-medium">Roadmap direction: </span>
                    {rec.roadmapDirection}
                  </p>
                )}
                {rec.suitableProjects.length > 0 && (
                  <p>
                    <span className="font-medium">Suitable projects: </span>
                    {rec.suitableProjects.join(", ")}
                  </p>
                )}
                {rec.jobSearchDirection && (
                  <p>
                    <span className="font-medium">Job search: </span>
                    {rec.jobSearchDirection}
                  </p>
                )}
              </div>
            </div>
          ))}
        </Reveal>
      )}
      {!mutation.isPending && !result && (
        <EmptyState
          icon={Sparkles}
          title="No recommendations yet"
          description="Generate recommendations based on your profile."
        />
      )}
    </AppShell>
  );
}
