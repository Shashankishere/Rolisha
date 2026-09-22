import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ExternalLink,
  FolderGit2,
  Lightbulb,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getLearningTopic,
  completeLearningTopic,
  toggleLessonComplete,
  getRecommendedNextTopic,
} from "@/lib/learning.functions";
import { getProjects } from "@/lib/projects.functions";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { PROFICIENCY_LABEL } from "@/lib/domain";
import { showMutationError } from "@/components/app/upgrade-prompt";

function topicQuery(slug: string) {
  return queryOptions({
    queryKey: ["learning-topic", slug],
    queryFn: () => getLearningTopic({ data: { slug } }),
  });
}

export const Route = createFileRoute("/_authenticated/learn/$topicSlug")({
  loader: async ({ context, params }) => {
    const topic = await context.queryClient.ensureQueryData(topicQuery(params.topicSlug));
    if (!topic) throw notFound();
    return topic;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — Rolisha` : "Learn — Rolisha" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => (
    <AppShell title="Topic not found" description="This learning topic isn't available yet.">
      <Button asChild variant="outline" size="sm">
        <Link to="/skills">
          <ArrowLeft className="size-4" /> Back to skill gap
        </Link>
      </Button>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="learn.$topicSlug"
      title="Unable to load this topic"
      description="Please refresh to try again."
    />
  ),
  component: LearningTopicPage,
});

function LearningTopicPage() {
  const { topicSlug } = Route.useParams();
  const { data: topic } = useSuspenseQuery(topicQuery(topicSlug));
  const queryClient = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<number | null>(null);
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });
  const isPro = subscription?.features.unlimited_learning === true;
  const { data: nextTopic } = useQuery({
    queryKey: ["recommended-next-topic"],
    queryFn: () => getRecommendedNextTopic(),
    enabled: isPro,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["learning-topic", topicSlug] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
    queryClient.invalidateQueries({ queryKey: ["learning-topic-refs"] });
  };

  const lessonMutation = useMutation({
    mutationFn: (vars: { lessonOrder: number; completed: boolean }) =>
      toggleLessonComplete({ data: { topicId: topic!.id, ...vars } }),
    onSuccess: invalidate,
    onError: (error) => showMutationError(error, "Could not update that lesson."),
  });

  const completeMutation = useMutation({
    mutationFn: (viaSkip: boolean) =>
      completeLearningTopic({ data: { topicId: topic!.id, viaSkip } }),
    onSuccess: () => {
      invalidate();
      toast.success("Skill updated on your roadmap.");
    },
    onError: (error) => showMutationError(error, "Could not complete this topic."),
  });

  if (!topic) return null;

  const completedCount = topic.lessons.filter((l) => l.completed).length;
  const totalLessons = topic.lessons.length;
  const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const allLessonsDone = totalLessons > 0 && completedCount === totalLessons;
  const active = activeLesson !== null ? topic.lessons.find((l) => l.order === activeLesson) : null;
  const matchedProject = (projects ?? []).find((p) =>
    p.skills.some((s) => s.toLowerCase() === topic.skillName.toLowerCase()),
  );

  return (
    <AppShell
      title={topic.title}
      description={`Part of ${topic.skillName} — ${PROFICIENCY_LABEL[topic.currentLevel]} now, targeting ${PROFICIENCY_LABEL[topic.targetLevel]}.`}
      breadcrumb={[{ label: "Skill gap", to: "/skills" }]}
    >
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4 lg:order-1">
          <section className="panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{topic.difficulty}</Badge>
              <Badge variant="outline">{topic.estimatedHours}h estimated</Badge>
              {topic.status === "completed" && (
                <Badge className="bg-success-soft text-success gap-1 border-none">
                  <Check className="size-3" /> Completed
                </Badge>
              )}
            </div>
            <div className="mt-4 flex items-start gap-2">
              <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" />
              <p className="text-muted-foreground text-sm">{topic.whyItMatters}</p>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Lessons</h2>
              <span className="text-muted-foreground text-xs">
                {completedCount}/{totalLessons}
              </span>
            </div>
            <Progress value={percent} className="mt-2" />
            <ol className="mt-4 space-y-1">
              {topic.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    onClick={() => setActiveLesson(lesson.order)}
                    className={
                      activeLesson === lesson.order
                        ? "bg-primary-soft text-primary flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
                        : "hover:bg-muted flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm"
                    }
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                    ) : (
                      <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    )}
                    <span>
                      {lesson.order}. {lesson.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {topic.assessmentTitle && (
            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="text-muted-foreground size-4" />
                <h2 className="text-sm font-semibold">Quick quiz</h2>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {topic.assessmentPassed
                  ? `You've passed ${topic.assessmentTitle}.`
                  : `Test yourself with ${topic.assessmentTitle} once you've been through the lessons.`}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/assessments">
                  {topic.assessmentPassed ? "Retake quiz" : "Take quiz"}
                </Link>
              </Button>
            </section>
          )}

          {matchedProject && (
            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <FolderGit2 className="text-muted-foreground size-4" />
                <h2 className="text-sm font-semibold">Related project</h2>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Put {topic.skillName} into practice with "{matchedProject.title}".
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/projects/$projectId" params={{ projectId: matchedProject.id }}>
                  {matchedProject.status === "not_started" ? "Open project" : "Continue project"}
                </Link>
              </Button>
            </section>
          )}

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Mark this skill</h2>
            <Button
              className="mt-3 w-full"
              disabled={
                !allLessonsDone || completeMutation.isPending || topic.status === "completed"
              }
              onClick={() => completeMutation.mutate(false)}
            >
              {topic.status === "completed" ? "Completed" : "Mark skill complete"}
            </Button>
            {!allLessonsDone && topic.status !== "completed" && (
              <p className="text-muted-foreground mt-2 text-xs">
                Finish all lessons to mark this skill complete — or skip ahead below.
              </p>
            )}
            {topic.status !== "completed" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                disabled={completeMutation.isPending}
                onClick={() => completeMutation.mutate(true)}
              >
                Skip — I already know this
              </Button>
            )}
          </section>

          {isPro &&
            topic.status === "completed" &&
            nextTopic &&
            nextTopic.topicSlug !== topic.slug && (
              <section className="panel border-primary/30 bg-primary-soft/40 p-5">
                <h2 className="text-primary text-sm font-semibold">Recommended next</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  {nextTopic.skillName} is your next highest-priority gap
                  {nextTopic.estimatedHours ? ` · about ${nextTopic.estimatedHours}h` : ""}.
                </p>
                <Button asChild size="sm" className="mt-3 w-full">
                  <Link to="/learn/$topicSlug" params={{ topicSlug: nextTopic.topicSlug }}>
                    Learn {nextTopic.topicTitle}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </section>
            )}
        </aside>

        <div className="min-w-0 space-y-6 lg:order-2">
          {topic.objectives.length > 0 && (
            <section className="panel p-6">
              <h2 className="font-display text-lg font-semibold">Learning objectives</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {topic.objectives.map((o) => (
                  <li key={o} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {active ? (
            <section className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">
                  Lesson {active.order}: {active.title}
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    lessonMutation.isPending &&
                    lessonMutation.variables?.lessonOrder === active.order
                  }
                  onClick={() =>
                    lessonMutation.mutate({
                      lessonOrder: active.order,
                      completed: !active.completed,
                    })
                  }
                >
                  {active.completed ? (
                    <>
                      <CheckCircle2 className="size-3.5" /> Completed
                    </>
                  ) : (
                    "Mark lesson complete"
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed whitespace-pre-line">
                {active.content}
              </p>
              {active.example && (
                <div className="bg-surface mt-4 rounded-xl border border-border/70 p-4">
                  <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Example
                  </p>
                  <p className="mt-1.5 font-mono text-sm">{active.example}</p>
                </div>
              )}
              {active.practice && (
                <div className="border-primary/20 bg-primary-soft/40 mt-4 rounded-xl border p-4">
                  <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                    Practice
                  </p>
                  <p className="mt-1.5 text-sm">{active.practice}</p>
                </div>
              )}
              <div className="mt-6 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={active.order <= 1}
                  onClick={() => setActiveLesson(active.order - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={active.order >= totalLessons}
                  onClick={() => setActiveLesson(active.order + 1)}
                >
                  Next lesson
                </Button>
              </div>
            </section>
          ) : (
            <section className="panel p-10 text-center">
              <p className="text-sm font-medium">Pick a lesson from the left to get started.</p>
              <Button className="mt-4" onClick={() => setActiveLesson(1)}>
                Start lesson 1
              </Button>
            </section>
          )}

          {topic.commonMistakes.length > 0 && (
            <section className="panel p-6">
              <h2 className="font-display text-lg font-semibold">Common mistakes</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {topic.commonMistakes.map((m) => (
                  <li key={m} className="flex gap-2">
                    <span className="text-destructive">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topic.resources.length > 0 && (
            <section className="panel p-6">
              <h2 className="font-display text-lg font-semibold">Resources</h2>
              <ul className="mt-3 space-y-2.5 text-sm">
                {topic.resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary flex items-start gap-2 hover:underline"
                    >
                      <ExternalLink className="mt-0.5 size-4 shrink-0" />
                      <span>
                        {r.title}
                        {r.provider && (
                          <span className="text-muted-foreground"> — {r.provider}</span>
                        )}
                      </span>
                    </a>
                    <p className="text-muted-foreground ml-6 mt-0.5 text-xs capitalize">
                      {r.type}
                      {r.isFree ? ", free" : ", paid"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
