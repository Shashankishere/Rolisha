import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  getAssessment,
  getAssessments,
  getSkillPerformance,
  submitAttempt,
} from "@/lib/assessments.functions";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { showMutationError, LockedBadge } from "@/components/app/upgrade-prompt";
import type {
  AssessmentForTaking,
  AssessmentSummary,
  AttemptResult,
} from "@/lib/assessments.server";
import { PROFICIENCY_LABEL } from "@/lib/domain";

const assessmentsQuery = queryOptions({
  queryKey: ["assessments"],
  queryFn: () => getAssessments(),
});

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** A real, deterministic estimate derived from the assessment's actual
 * question count — never a hardcoded number. About 90 seconds per
 * question, rounded up to the nearest 5 minutes so it reads cleanly. */
function estimatedMinutes(questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.max(5, Math.ceil((questionCount * 1.5) / 5) * 5);
}

export const Route = createFileRoute("/_authenticated/assessments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(assessmentsQuery),
  head: () => ({
    meta: [{ title: "Assessments — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="assessments"
      title="Assessments unavailable"
      description="Please refresh to try again."
    />
  ),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const { data } = useSuspenseQuery(assessmentsQuery);
  const { assessments, targetRoleTitle, hasRoleMatch } = data;
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = assessments.find((a) => a.id === activeId) ?? null;

  const roleMatches = assessments.filter((a) => a.isRoleMatch);
  const otherAssessments = assessments.filter((a) => !a.isRoleMatch);

  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });
  const isPro = subscription?.features.advanced_assessments === true;
  const { data: performance } = useQuery({
    queryKey: ["skill-performance"],
    queryFn: () => getSkillPerformance(),
    enabled: isPro && hasRoleMatch,
  });

  return (
    <AppShell
      title="Assessments"
      description={
        targetRoleTitle
          ? `Skill challenges scoped to ${targetRoleTitle}, graded honestly. A passing score updates your skill level on your roadmap.`
          : "Short skill challenges, graded honestly. A passing score updates your skill level on your roadmap."
      }
    >
      {assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments available yet"
          description="Check back soon, more skill challenges are coming."
        />
      ) : (
        <div className="space-y-10">
          {isPro && performance && performance.rows.length > 0 && (
            <Reveal>
              <section className="panel p-5">
                <h2 className="font-display text-sm font-semibold">
                  Skill performance
                  {performance.targetRoleTitle ? `: ${performance.targetRoleTitle}` : ""}
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {performance.rows.map((row) => (
                    <li key={row.skillId} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm">{row.skillName}</span>
                      <Progress value={row.score ?? 0} className="h-2 flex-1" />
                      <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
                        {row.score != null ? `${row.score}%` : "Not attempted"}
                      </span>
                    </li>
                  ))}
                </ul>
                {performance.recommendedNextSkill && (
                  <div className="border-border/60 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      Recommended: Learn {performance.recommendedNextSkill}
                    </span>
                    {performance.recommendedTopicSlug && (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/learn/$topicSlug"
                          params={{ topicSlug: performance.recommendedTopicSlug }}
                        >
                          Start learning
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </section>
            </Reveal>
          )}
          {!isPro && hasRoleMatch && roleMatches.some((a) => a.bestScore !== null) && (
            <div className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-4">
              <p className="text-sm">
                A per skill score breakdown and recommended next skill are available with Pro.
              </p>
              <LockedBadge requiredPlan="pro" implemented />
            </div>
          )}
          {targetRoleTitle && (
            <section>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold">
                  Assessments for {targetRoleTitle}
                </h2>
              </div>
              {hasRoleMatch ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {roleMatches.map((assessment, i) => (
                    <Reveal key={assessment.id} delay={Math.min(i * 60, 240)} className="h-full">
                      <AssessmentCard
                        assessment={assessment}
                        onStart={() => setActiveId(assessment.id)}
                      />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mt-3 text-sm">
                  No assessments target {targetRoleTitle}'s skill profile yet. Try one of the
                  general skill challenges below.
                </p>
              )}
            </section>
          )}

          {otherAssessments.length > 0 && (
            <section>
              {targetRoleTitle && (
                <h2 className="font-display text-lg font-semibold">Other skill challenges</h2>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {otherAssessments.map((assessment, i) => (
                  <Reveal key={assessment.id} delay={Math.min(i * 60, 240)} className="h-full">
                    <AssessmentCard
                      assessment={assessment}
                      onStart={() => setActiveId(assessment.id)}
                    />
                  </Reveal>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {active && <QuizDialog assessment={active} onClose={() => setActiveId(null)} />}
    </AppShell>
  );
}

function AssessmentCard({
  assessment,
  onStart,
}: {
  assessment: AssessmentSummary;
  onStart: () => void;
}) {
  const minutes = estimatedMinutes(assessment.questionCount);

  return (
    <div className="panel hover-lift group flex h-full flex-col gap-4 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="bg-primary-soft text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Target className="size-5" />
        </div>
        {assessment.passed && (
          <Badge className="bg-success-soft text-success gap-1 border-none">
            <Check className="size-3" />
            Passed
          </Badge>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{assessment.title}</h2>
          {assessment.isRoleMatch && (
            <Badge className="bg-primary-soft text-primary gap-1 border-none">
              <Sparkles className="size-3" />
              For your role
            </Badge>
          )}
        </div>
        {assessment.description && (
          <p className="text-muted-foreground mt-1 text-sm">{assessment.description}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {assessment.skillName && (
          <Badge className="bg-muted text-foreground border-none">{assessment.skillName}</Badge>
        )}
        <Badge variant="outline">
          {DIFFICULTY_LABEL[assessment.difficulty] ?? assessment.difficulty}
        </Badge>
        <Badge variant="outline">
          <Clock className="size-3" /> {minutes > 0 ? `~${minutes} min` : "Quick"}
        </Badge>
        <Badge variant="outline">
          {assessment.questionCount} question{assessment.questionCount === 1 ? "" : "s"}
        </Badge>
      </div>

      {assessment.attemptCount > 0 && (
        <p className="text-muted-foreground text-sm">
          Best score: <span className="text-foreground font-medium">{assessment.bestScore}%</span>{" "}
          across {assessment.attemptCount} attempt{assessment.attemptCount === 1 ? "" : "s"}
        </p>
      )}

      <Button
        className="mt-auto"
        size="sm"
        onClick={onStart}
        disabled={assessment.questionCount === 0}
      >
        {assessment.attemptCount > 0 ? "Retake assessment" : "Start assessment"}
      </Button>
    </div>
  );
}

type QuizPhase = "intro" | "quiz" | "result";

function QuizDialog({
  assessment,
  onClose,
}: {
  assessment: AssessmentSummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const quizQuery = useQuery({
    queryKey: ["assessment-quiz", assessment.id],
    queryFn: () => getAssessment({ data: { assessmentId: assessment.id } }),
  });

  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const submitMutation = useMutation({
    mutationFn: () => {
      const orderedAnswers = (quizQuery.data?.questions ?? []).map((q) => answers[q.id] ?? null);
      return submitAttempt({ data: { assessmentId: assessment.id, answers: orderedAnswers } });
    },
    onSuccess: (data) => {
      setResult(data);
      setPhase("result");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error: Error) =>
      showMutationError(error, error.message || "Could not submit your answers."),
  });

  const questions = quizQuery.data?.questions ?? [];
  const currentQuestion = questions[step];
  const isLastQuestion = step === questions.length - 1;
  const minutes = estimatedMinutes(assessment.questionCount);

  function handleClose(open: boolean) {
    if (open) return;
    if (submitMutation.isPending) return;
    onClose();
  }

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="sr-only">{assessment.title}</DialogTitle>

        {quizQuery.isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        )}

        {quizQuery.isError && (
          <p className="text-destructive text-sm">
            Couldn't load this assessment. Please close and try again.
          </p>
        )}

        {!quizQuery.isLoading && !quizQuery.isError && phase === "intro" && (
          <AssessmentIntro
            assessment={assessment}
            minutes={minutes}
            questionCount={questions.length}
            onStart={() => setPhase("quiz")}
          />
        )}

        {phase === "quiz" && currentQuestion && (
          <QuizQuestion
            step={step}
            totalQuestions={questions.length}
            question={currentQuestion}
            selected={answers[currentQuestion.id] ?? null}
            onSelect={(i) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: i }))}
            onBack={() => setStep((s) => s - 1)}
            onNext={() => setStep((s) => s + 1)}
            onSubmit={() => submitMutation.mutate()}
            isFirst={step === 0}
            isLast={isLastQuestion}
            isSubmitting={submitMutation.isPending}
          />
        )}

        {phase === "result" && result && (
          <QuizResult
            result={result}
            assessment={assessment}
            questions={questions}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssessmentIntro({
  assessment,
  minutes,
  questionCount,
  onStart,
}: {
  assessment: AssessmentSummary;
  minutes: number;
  questionCount: number;
  onStart: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="bg-primary-soft text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
          <Target className="size-6" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{assessment.title}</h2>
          {assessment.skillName && (
            <p className="text-muted-foreground text-sm">Skill focus: {assessment.skillName}</p>
          )}
        </div>
      </div>

      {assessment.description && (
        <div>
          <h3 className="text-sm font-semibold">What you'll learn</h3>
          <p className="text-muted-foreground mt-1 text-sm">{assessment.description}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/60 rounded-xl p-3">
          <p className="text-base font-semibold">
            {DIFFICULTY_LABEL[assessment.difficulty] ?? assessment.difficulty}
          </p>
          <p className="text-muted-foreground text-xs">Difficulty</p>
        </div>
        <div className="bg-muted/60 rounded-xl p-3">
          <p className="text-base font-semibold">{minutes > 0 ? `~${minutes} min` : "Quick"}</p>
          <p className="text-muted-foreground text-xs">Estimated time</p>
        </div>
        <div className="bg-muted/60 rounded-xl p-3">
          <p className="text-base font-semibold">{questionCount}</p>
          <p className="text-muted-foreground text-xs">Question{questionCount === 1 ? "" : "s"}</p>
        </div>
      </div>

      {assessment.attemptCount > 0 && (
        <p className="text-muted-foreground text-sm">
          Your best score so far is{" "}
          <span className="text-foreground font-medium">{assessment.bestScore}%</span> across{" "}
          {assessment.attemptCount} attempt{assessment.attemptCount === 1 ? "" : "s"}. This helps
          measure your job readiness for {assessment.skillName ?? "this skill"}.
        </p>
      )}

      <Button className="w-full" size="lg" onClick={onStart} disabled={questionCount === 0}>
        Start assessment
      </Button>
    </div>
  );
}

function QuizQuestion({
  step,
  totalQuestions,
  question,
  selected,
  onSelect,
  onBack,
  onNext,
  onSubmit,
  isFirst,
  isLast,
  isSubmitting,
}: {
  step: number;
  totalQuestions: number;
  question: AssessmentForTaking["questions"][number];
  selected: number | null;
  onSelect: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isFirst: boolean;
  isLast: boolean;
  isSubmitting: boolean;
}) {
  const percent = Math.round(((step + 1) / totalQuestions) * 100);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            Question {step + 1} of {totalQuestions}
          </span>
          <span className="text-muted-foreground font-medium tabular-nums">
            {percent}% complete
          </span>
        </div>
        <Progress value={percent} className="mt-2" />
      </div>

      <p className="text-base leading-snug font-semibold">{question.prompt}</p>

      <div className="grid gap-2.5" role="radiogroup" aria-label="Answer choices">
        {question.options.map((option, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(i)}
              className={
                "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
                (isSelected
                  ? "border-primary bg-primary-soft/60 font-medium"
                  : "border-border/70 hover:border-primary/40 hover:bg-muted/40")
              }
            >
              <span
                className={
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
                  (isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40")
                }
                aria-hidden="true"
              >
                {isSelected && <Check className="size-3" />}
              </span>
              <span className="min-w-0">{option}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={isFirst} onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {isLast ? (
          <Button disabled={selected === null || isSubmitting} onClick={onSubmit}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Submit assessment
          </Button>
        ) : (
          <Button disabled={selected === null} onClick={onNext}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function performanceLabel(score: number): string {
  if (score >= 85) return "Excellent understanding";
  if (score >= 70) return "Strong understanding";
  if (score >= 50) return "Good foundation";
  return "Needs more practice";
}

function QuizResult({
  result,
  assessment,
  questions,
  onClose,
}: {
  result: AttemptResult;
  assessment: AssessmentSummary;
  questions: AssessmentForTaking["questions"];
  onClose: () => void;
}) {
  const promptById = new Map(questions.map((q) => [q.id, q.prompt]));
  const strengths = result.perQuestion.filter((q) => q.correct);
  const gaps = result.perQuestion.filter((q) => !q.correct);
  const scoreColor = result.passed
    ? "bg-success-soft text-success shadow-success/20"
    : "bg-warning-soft text-warning shadow-warning/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <div
          className={`grid size-20 place-items-center rounded-full text-2xl font-bold shadow-lg transition-transform duration-500 ${scoreColor}`}
        >
          {result.score}%
        </div>
        <p className="text-base font-semibold">{performanceLabel(result.score)}</p>
        <p className="text-muted-foreground text-sm">
          {result.correctCount} of {result.totalQuestions} correct
          {result.passed ? ", you passed" : ", not a pass yet"}
        </p>
        {assessment.skillName && (
          <Badge className="bg-muted text-foreground mt-1 border-none">
            {assessment.skillName}: {PROFICIENCY_LABEL[result.resultingLevel]}
          </Badge>
        )}
      </div>

      {strengths.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="text-success size-4" /> Strengths
          </h3>
          <ul className="mt-2 space-y-1.5">
            {strengths.map((q) => (
              <li key={q.questionId} className="flex items-start gap-2 text-sm">
                <Check className="text-success mt-0.5 size-3.5 shrink-0" />
                <span className="text-muted-foreground">
                  {promptById.get(q.questionId) ?? "Question"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="text-warning size-4" /> Areas to improve
          </h3>
          <ul className="mt-2 space-y-2">
            {gaps.map((q) => (
              <li key={q.questionId} className="text-sm">
                <span className="flex items-start gap-2">
                  <X className="text-destructive mt-0.5 size-3.5 shrink-0" />
                  <span className="text-muted-foreground">
                    {promptById.get(q.questionId) ?? "Question"}
                  </span>
                </span>
                {q.explanation && (
                  <p className="text-muted-foreground/80 mt-1 ml-5.5 text-xs">{q.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-border/60 space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Recommended for you</h3>
        {assessment.skillId && (
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link to="/skills">
              <Target className="size-3.5" />
              Review your skill gap
            </Link>
          </Button>
        )}
        {!result.passed && (
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link to="/roadmap">
              <ArrowRight className="size-3.5" />
              Continue your roadmap
            </Link>
          </Button>
        )}
      </div>

      <Button className="w-full" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
