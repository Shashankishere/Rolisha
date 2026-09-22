import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt, showMutationError } from "@/components/app/upgrade-prompt";
import { AiStatusNotice } from "@/components/app/premium/ai-status-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO } from "@/lib/subscription";
import { generateInterviewQuestions } from "@/lib/premium/interview-questions.functions";
import type { InterviewQuestionSetRow } from "@/lib/premium/interview-questions.server";

export const Route = createFileRoute("/_authenticated/premium/interview-questions")({
  head: () => ({
    meta: [
      { title: "Personalized Interview Questions — Rolisha" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-interview-questions"
      title="Interview questions unavailable"
      description="Please refresh to try again."
    />
  ),
  component: Page,
});

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  project_based: "Project based",
  role_specific: "Role specific",
};

function Page() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });

  if (isLoading) {
    return (
      <AppShell
        title="Personalized interview questions"
        breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      >
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.personalized_interview_questions) {
    return (
      <AppShell
        title="Personalized interview questions"
        breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      >
        <UpgradePrompt
          feature="personalized_interview_questions"
          label={FEATURE_INFO.personalized_interview_questions.label}
          description={FEATURE_INFO.personalized_interview_questions.description}
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
  const [result, setResult] = useState<InterviewQuestionSetRow | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: () => generateInterviewQuestions({ data: { targetRole } }),
    onSuccess: (data) => {
      setResult(data);
      setExpanded(null);
    },
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not generate questions."),
  });

  return (
    <AppShell
      title="Personalized interview questions"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description="Generated from your real skills, projects, and target role."
    >
      <div className="mx-auto max-w-xl">
        <Reveal>
          <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="q-role">Target role</Label>
              <Input
                id="q-role"
                className="mt-1.5"
                placeholder="e.g. UX Designer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <Button
              disabled={targetRole.trim().length < 2 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Generate questions
            </Button>
          </div>
        </Reveal>
      </div>

      <div className="mt-6 space-y-3">
        {mutation.isPending && <AiStatusNotice status="pending" />}
        {!mutation.isPending && result?.status === "failed" && (
          <AiStatusNotice
            status="failed"
            errorMessage={result.errorMessage}
            onRetry={() => mutation.mutate()}
          />
        )}
        {!mutation.isPending && result?.status === "completed" && (
          <Reveal className="space-y-3">
            {result.questions.map((q, i) => (
              <div key={i} className="panel p-5">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div>
                    <Badge variant="outline" className="mb-1.5 text-xs">
                      {CATEGORY_LABEL[q.category] ?? q.category}
                    </Badge>
                    <p className="text-sm font-medium">{q.question}</p>
                  </div>
                </button>
                {expanded === i && (
                  <div className="border-border/60 mt-3 space-y-2 border-t pt-3 text-sm">
                    {q.whyItMatters && (
                      <p>
                        <span className="font-medium">Why it matters: </span>
                        <span className="text-muted-foreground">{q.whyItMatters}</span>
                      </p>
                    )}
                    {q.evaluates && (
                      <p>
                        <span className="font-medium">Evaluates: </span>
                        <span className="text-muted-foreground">{q.evaluates}</span>
                      </p>
                    )}
                    {q.answerGuidance && (
                      <p>
                        <span className="font-medium">Answer guidance: </span>
                        <span className="text-muted-foreground">{q.answerGuidance}</span>
                      </p>
                    )}
                    {q.prepTopic && (
                      <p>
                        <span className="font-medium">Prep topic: </span>
                        <span className="text-muted-foreground">{q.prepTopic}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Reveal>
        )}
        {!mutation.isPending && !result && (
          <EmptyState
            icon={MessagesSquare}
            title="No questions yet"
            description="Enter a target role above to generate personalized questions."
          />
        )}
      </div>
    </AppShell>
  );
}
