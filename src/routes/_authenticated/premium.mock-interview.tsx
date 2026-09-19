import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageSquareText } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { UpgradePrompt, showMutationError } from "@/components/app/upgrade-prompt";
import { AiStatusNotice } from "@/components/app/premium/ai-status-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO } from "@/lib/subscription";
import {
  finishMockInterview,
  startMockInterview,
  submitMockInterviewAnswer,
} from "@/lib/premium/mock-interview.functions";
import type { MockInterviewSession } from "@/lib/premium/mock-interview.server";

export const Route = createFileRoute("/_authenticated/premium/mock-interview")({
  head: () => ({
    meta: [{ title: "Mock Interview — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium-mock-interview"
      title="Mock interview unavailable"
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
      <AppShell title="Mock interview" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (subscription && !subscription.features.mock_interviews) {
    return (
      <AppShell title="Mock interview" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <UpgradePrompt
          feature="mock_interviews"
          label={FEATURE_INFO.mock_interviews.label}
          description={FEATURE_INFO.mock_interviews.description}
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
  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [activeTurn, setActiveTurn] = useState(0);
  const [answer, setAnswer] = useState("");

  const startMutation = useMutation({
    mutationFn: () => startMockInterview({ data: { targetRole } }),
    onSuccess: (data) => {
      setSession(data);
      setActiveTurn(0);
      setAnswer("");
    },
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not start a mock interview."),
  });

  const answerMutation = useMutation({
    mutationFn: () =>
      submitMockInterviewAnswer({
        data: { sessionId: session!.id, turnIndex: activeTurn, answer },
      }),
    onSuccess: (turn) => {
      setSession((prev) =>
        prev ? { ...prev, turns: prev.turns.map((t) => (t.id === turn.id ? turn : t)) } : prev,
      );
      setAnswer("");
    },
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not submit your answer."),
  });

  const finishMutation = useMutation({
    mutationFn: () => finishMockInterview({ data: { sessionId: session!.id } }),
    onSuccess: setSession,
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not finish this session."),
  });

  if (!session) {
    return (
      <AppShell
        title="Mock interview"
        breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
        description="A text based mock interview: answer each question, then review feedback."
      >
        <div className="mx-auto max-w-xl">
          <Reveal>
            <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="mock-role">Target role</Label>
                <Input
                  id="mock-role"
                  className="mt-1.5"
                  placeholder="e.g. Data Scientist"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>
              <Button
                disabled={targetRole.trim().length < 2 || startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Start interview
              </Button>
            </div>
          </Reveal>
          {startMutation.isPending && (
            <div className="mt-4">
              <AiStatusNotice status="pending" />
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (session.status === "failed") {
    return (
      <AppShell title="Mock interview" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <AiStatusNotice
          status="failed"
          errorMessage={session.errorMessage}
          onRetry={() => setSession(null)}
          retryLabel="Start over"
        />
      </AppShell>
    );
  }

  if (session.status === "completed") {
    return (
      <AppShell title="Mock interview results" breadcrumb={[{ label: "AI Tools", to: "/premium" }]}>
        <Reveal className="space-y-4">
          {session.overallSummary && (
            <div className="panel p-5">
              <h3 className="text-sm font-semibold">Overall summary</h3>
              <p className="text-muted-foreground mt-1 text-sm">{session.overallSummary}</p>
            </div>
          )}
          {session.overallFeedback.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {session.overallFeedback.map((area, i) => (
                <div key={i} className="panel flex h-full flex-col p-5">
                  <h4 className="text-sm font-semibold">{area.area}</h4>
                  <p className="text-muted-foreground mt-1 text-sm">{area.note}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {session.turns.map((turn) => (
              <div key={turn.id} className="panel p-5">
                <Badge variant="outline" className="mb-1.5 text-xs capitalize">
                  {turn.category}
                </Badge>
                <p className="text-sm font-medium">{turn.question}</p>
                {turn.answer && <p className="text-muted-foreground mt-2 text-sm">{turn.answer}</p>}
                {turn.feedback?.status === "completed" && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <MiniScore label="Quality" value={turn.feedback.quality} />
                    <MiniScore label="Relevance" value={turn.feedback.relevance} />
                    <MiniScore label="Completeness" value={turn.feedback.completeness} />
                    <MiniScore label="Communication" value={turn.feedback.communication} />
                    <MiniScore label="Technical depth" value={turn.feedback.technicalDepth} />
                  </div>
                )}
                {turn.feedback?.status === "failed" && (
                  <p className="text-destructive mt-2 text-xs">{turn.feedback.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setSession(null)}>
            Start another mock interview
          </Button>
        </Reveal>
      </AppShell>
    );
  }

  const current = session.turns[activeTurn];
  const isLast = activeTurn === session.turns.length - 1;

  return (
    <AppShell
      title="Mock interview"
      breadcrumb={[{ label: "AI Tools", to: "/premium" }]}
      description={`Question ${activeTurn + 1} of ${session.turns.length}`}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {current && (
          <Reveal>
            <div className="panel p-5">
              <Badge variant="outline" className="mb-2 text-xs capitalize">
                {current.category}
              </Badge>
              <p className="font-medium">{current.question}</p>
              {!current.answer ? (
                <>
                  <Textarea
                    className="mt-3 min-h-32"
                    placeholder="Type your answer…"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <Button
                    className="mt-3"
                    disabled={answer.trim().length === 0 || answerMutation.isPending}
                    onClick={() => answerMutation.mutate()}
                  >
                    {answerMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    Submit answer
                  </Button>
                  {answerMutation.isPending && (
                    <div className="mt-3">
                      <AiStatusNotice status="pending" />
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="bg-muted/40 flex items-start gap-2 rounded-lg p-3 text-sm">
                    <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                    <p>{current.answer}</p>
                  </div>
                  {current.feedback?.status === "completed" && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <MiniScore label="Quality" value={current.feedback.quality} />
                      <MiniScore label="Relevance" value={current.feedback.relevance} />
                      <MiniScore label="Completeness" value={current.feedback.completeness} />
                      <MiniScore label="Communication" value={current.feedback.communication} />
                      <MiniScore label="Technical depth" value={current.feedback.technicalDepth} />
                    </div>
                  )}
                  {current.feedback?.status === "failed" && (
                    <p className="text-destructive text-xs">{current.feedback.errorMessage}</p>
                  )}
                  <div className="flex gap-2">
                    {!isLast && (
                      <Button
                        onClick={() => {
                          setActiveTurn(activeTurn + 1);
                          setAnswer("");
                        }}
                      >
                        Next question
                      </Button>
                    )}
                    <Button
                      variant={isLast ? "default" : "outline"}
                      disabled={finishMutation.isPending}
                      onClick={() => finishMutation.mutate()}
                    >
                      {finishMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                      Finish interview
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        )}
        {!current && (
          <EmptyState
            icon={MessageSquareText}
            title="No questions generated"
            description="Try starting a new mock interview."
          />
        )}
      </div>
    </AppShell>
  );
}

function MiniScore({ label, value }: { label: string; value?: number | undefined }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2 text-center">
      <p className="text-sm font-semibold">{value ?? "—"}</p>
      <p className="text-muted-foreground text-[10px] leading-tight">{label}</p>
    </div>
  );
}
