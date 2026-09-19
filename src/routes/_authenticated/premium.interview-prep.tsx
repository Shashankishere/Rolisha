import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ListChecks, Loader2 } from "lucide-react";
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
import { generateInterviewPrep } from "@/lib/premium/interview-prep.functions";
import type { InterviewPrepRow } from "@/lib/premium/interview-prep.server";

export const Route = createFileRoute("/_authenticated/premium/interview-prep")({
  head: () => ({
    meta: [{ title: "Interview Preparation — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-interview-prep"
      title="Interview preparation unavailable"
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
      <AppShell title="Interview preparation" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.interview_preparation) {
    return (
      <AppShell title="Interview preparation" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <UpgradePrompt
          feature="interview_preparation"
          label={FEATURE_INFO.interview_preparation.label}
          description={FEATURE_INFO.interview_preparation.description}
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
  const [targetRole, setTargetRole] = useState("");
  const [result, setResult] = useState<InterviewPrepRow | null>(null);

  const mutation = useMutation({
    mutationFn: () => generateInterviewPrep({ data: { targetRole } }),
    onSuccess: setResult,
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not build a preparation plan."),
  });

  return (
    <AppShell
      title="Interview preparation"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description="A study plan based on likely areas for this role — not a guarantee of what will be asked."
    >
      <div className="mx-auto max-w-xl">
        <Reveal>
          <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="prep-role">Target role</Label>
              <Input
                id="prep-role"
                className="mt-1.5"
                placeholder="e.g. Backend Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <Button
              disabled={targetRole.trim().length < 2 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Build plan
            </Button>
          </div>
        </Reveal>
      </div>

      <div className="mt-6 space-y-4">
        {mutation.isPending && <AiStatusNotice status="pending" />}
        {!mutation.isPending && result?.status === "failed" && (
          <AiStatusNotice
            status="failed"
            errorMessage={result.errorMessage}
            onRetry={() => mutation.mutate()}
          />
        )}
        {!mutation.isPending && result?.status === "completed" && <PrepResult result={result} />}
        {!mutation.isPending && !result && (
          <EmptyState
            icon={ListChecks}
            title="No preparation plan yet"
            description="Enter a target role above to generate one."
          />
        )}
      </div>
    </AppShell>
  );
}

function PrepResult({ result }: { result: InterviewPrepRow }) {
  return (
    <Reveal className="grid gap-4 lg:grid-cols-2">
      <TopicList title="Technical topics" items={result.technicalTopics} />
      <TopicList title="Behavioral topics" items={result.behavioralTopics} />
      <SimpleList title="Role specific areas" items={result.roleSpecificAreas} />
      <SimpleList title="Pre interview checklist" items={result.checklist} checklist />
      <div className="panel flex h-full flex-col p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold">Study recommendations</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm">
          {result.studyRecommendations.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

function TopicList({ title, items }: { title: string; items: { topic: string; why: string }[] }) {
  return (
    <div className="panel flex h-full flex-col p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">None identified.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {items.map((item, i) => (
            <li key={i}>
              <p className="text-sm font-medium">{item.topic}</p>
              <p className="text-muted-foreground text-xs">{item.why}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SimpleList({
  title,
  items,
  checklist,
}: {
  title: string;
  items: string[];
  checklist?: boolean;
}) {
  return (
    <div className="panel flex h-full flex-col p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">None identified.</p>
      ) : (
        <ul className={checklist ? "mt-2 space-y-1.5" : "mt-2 list-disc space-y-1.5 pl-4 text-sm"}>
          {items.map((item, i) =>
            checklist ? (
              <li key={i} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 size-3.5" />
                <span>{item}</span>
              </li>
            ) : (
              <li key={i}>{item}</li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
