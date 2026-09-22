import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TaskWorkspaceDialog } from "@/components/app/projects/task-workspace-dialog";
import { getProjectDetail, setProjectStatus } from "@/lib/projects.functions";
import {
  applyProjectStatusToDetail,
  applyProjectStatusToListItem,
  type ProjectDetail,
  type ProjectListItem,
} from "@/lib/projects.server";
import { showMutationError } from "@/components/app/upgrade-prompt";

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function projectDetailQuery(projectId: string) {
  return queryOptions({
    queryKey: ["project", projectId],
    queryFn: () => getProjectDetail({ data: { projectId } }),
  });
}

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  loader: async ({ context, params }) => {
    const project = await context.queryClient.ensureQueryData(projectDetailQuery(params.projectId));
    if (!project) throw notFound();
    return project;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — Rolisha` : "Project — Rolisha" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => (
    <AppShell title="Project not found" description="This project may have been removed.">
      <Button asChild variant="outline" size="sm">
        <Link to="/projects">
          <ArrowLeft className="size-4" /> Back to Projects
        </Link>
      </Button>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="projects.$projectId"
      title="Unable to load this project"
      description="Please refresh to try again."
    />
  ),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useSuspenseQuery(projectDetailQuery(projectId));
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  // Shows the "Project Started" confirmation panel for one render cycle
  // right after a successful start, so the transition feels intentional
  // instead of the button silently swapping labels. Cleared as soon as the
  // user acts on it or navigates the first task open.
  const [justStarted, setJustStarted] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const [activeTaskIndex, setActiveTaskIndex] = useState<number | null>(null);

  const statusMutation = useMutation({
    mutationFn: (status: "started" | "completed" | "not_started") =>
      setProjectStatus({ data: { projectId, status } }),
    onSuccess: async (_data, status) => {
      // Cancel any in-flight fetch for these keys FIRST. Without this, a
      // fetch already in progress before the mutation resolved (kicked off
      // by mount's refetchOnMount, a focus refetch, or the root auth
      // listener's broad invalidateQueries) can resolve *after* the
      // setQueryData below and silently overwrite it with pre-mutation
      // data — this is the actual cause of the project reverting to
      // "Start Project" several seconds after it correctly showed
      // "In Progress": nothing was wrong with the write or the read, an
      // older, slower read was simply allowed to land last.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["project", projectId] }),
        queryClient.cancelQueries({ queryKey: ["projects"] }),
      ]);
      // Patch the cache synchronously so the button/status switch the
      // instant the mutation resolves, instead of waiting on the
      // invalidate-triggered background refetch round trip.
      queryClient.setQueryData<ProjectDetail | null | undefined>(["project", projectId], (prev) =>
        applyProjectStatusToDetail(prev, status),
      );
      queryClient.setQueryData<ProjectListItem[] | undefined>(["projects"], (prev) =>
        applyProjectStatusToListItem(prev, projectId, status),
      );
      invalidate();
      if (status === "started") {
        setJustStarted(true);
        toast.success("Project started", {
          description: "Your project is now in progress.",
        });
      } else if (status === "completed") {
        toast.success("Project marked complete");
      }
    },
    onError: (error, status) =>
      showMutationError(
        error,
        status === "started"
          ? "Couldn't start the project. Please try again."
          : "Could not update this project.",
      ),
  });
  const isStarting = statusMutation.isPending && statusMutation.variables === "started";
  const isCompleting = statusMutation.isPending && statusMutation.variables === "completed";

  if (!project) return null;

  const completedCount = project.tasks.filter((t) => t.completed).length;
  const totalTasks = project.tasks.length;
  const percent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const allTasksDone = totalTasks === 0 || completedCount === totalTasks;

  const activeTask =
    activeTaskIndex !== null
      ? (project.tasks.find((t) => t.index === activeTaskIndex) ?? null)
      : null;
  const activeMilestone = project.milestones.find((m) =>
    m.tasks.some((t) => t.index === activeTaskIndex),
  );
  const nextTask = project.tasks.find((t) => !t.completed) ?? project.tasks[0] ?? null;

  async function copyBullet() {
    if (!project!.resumeBullet) return;
    try {
      await navigator.clipboard.writeText(project!.resumeBullet);
      setCopied(true);
      toast.success("Resume bullet copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the text manually.");
    }
  }

  return (
    <AppShell
      title={project.title}
      breadcrumb={[{ label: "Projects", to: "/projects" }]}
      {...(project.summary ? { description: project.summary } : {})}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <section className="panel hover-lift p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {DIFFICULTY_LABEL[project.difficulty] ?? project.difficulty}
              </Badge>
              <Badge variant="outline">{project.estimatedHours}h estimated</Badge>
              {project.careerTitle && <Badge variant="secondary">For {project.careerTitle}</Badge>}
              {project.status === "completed" && (
                <Badge className="bg-success-soft text-success gap-1 border-none">
                  <Check className="size-3" /> Completed
                </Badge>
              )}
            </div>

            <h2 className="font-display mt-5 text-lg font-semibold">Objective</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {project.summary ?? "Build this project end to end using the skills below."}
            </p>

            {project.expectedOutput && (
              <>
                <h2 className="font-display mt-5 text-lg font-semibold">What you'll build</h2>
                <p className="text-muted-foreground mt-2 text-sm">{project.expectedOutput}</p>
              </>
            )}

            {project.datasetSuggestion && (
              <>
                <h2 className="font-display mt-5 text-lg font-semibold">Dataset suggestion</h2>
                <p className="text-muted-foreground mt-2 text-sm">{project.datasetSuggestion}</p>
              </>
            )}

            {project.skills.length > 0 && (
              <>
                <h2 className="font-display mt-5 text-lg font-semibold">Skills & technologies</h2>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {project.skills.map((skill) => (
                    <li key={skill} className="bg-muted rounded-full px-2.5 py-1 text-xs">
                      {skill}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {project.prerequisites.length > 0 && (
              <>
                <h2 className="font-display mt-5 text-lg font-semibold">Prerequisites</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {project.prerequisites.map((prereq) => (
                    <li
                      key={prereq.name}
                      className={
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs " +
                        (prereq.ready
                          ? "bg-success-soft text-success"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {prereq.ready ? <Check className="size-3" /> : <span>○</span>}
                      {prereq.name}
                    </li>
                  ))}
                </ul>
                {project.prerequisites.some((p) => !p.ready) && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    You can start this project any time — these just show which of its skills you
                    already have some experience with.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="panel hover-lift p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Milestones</h2>
              <span className="text-muted-foreground text-xs">
                {completedCount} of {totalTasks} steps done
              </span>
            </div>
            {totalTasks > 0 ? (
              <>
                <Progress value={percent} className="mt-3" />
                <div className="mt-5 space-y-6">
                  {project.milestones.map((milestone, mIndex) => {
                    const isCurrent = mIndex === project.currentMilestoneIndex;
                    return (
                      <div key={milestone.label}>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              milestone.isComplete
                                ? "bg-success-soft text-success inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                : isCurrent
                                  ? "bg-primary text-primary-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                  : "bg-muted text-muted-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                            }
                          >
                            {milestone.isComplete ? <Check className="size-3.5" /> : mIndex + 1}
                          </span>
                          <p className="text-sm font-semibold">{milestone.label}</p>
                          {isCurrent && !milestone.isComplete && (
                            <Badge variant="secondary" className="text-[10px]">
                              Current
                            </Badge>
                          )}
                          <span className="text-muted-foreground ml-auto text-xs">
                            {milestone.completedCount}/{milestone.totalCount}
                          </span>
                        </div>
                        <ol className="mt-3 ml-6 space-y-3 border-l pl-3 sm:ml-8 sm:pl-5">
                          {milestone.tasks.map((task) => {
                            const StatusIcon =
                              task.status === "completed"
                                ? CheckCircle2
                                : task.status === "in_progress"
                                  ? CircleDot
                                  : Circle;
                            return (
                              <li key={task.index} className="flex items-start gap-3">
                                <span className="mt-0.5 shrink-0" aria-hidden="true">
                                  <StatusIcon
                                    className={
                                      task.status === "completed"
                                        ? "text-success size-5"
                                        : task.status === "in_progress"
                                          ? "text-primary size-5"
                                          : "text-muted-foreground size-5"
                                    }
                                  />
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTaskIndex(task.index)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                                    Step {task.index + 1}
                                    <span
                                      className={
                                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal " +
                                        (task.status === "completed"
                                          ? "bg-success-soft text-success"
                                          : task.status === "in_progress"
                                            ? "bg-primary-soft text-primary"
                                            : "bg-muted text-muted-foreground")
                                      }
                                    >
                                      {task.status === "completed"
                                        ? "Completed"
                                        : task.status === "in_progress"
                                          ? "In progress"
                                          : "Not started"}
                                    </span>
                                  </p>
                                  <p
                                    className={
                                      task.status === "completed"
                                        ? "text-muted-foreground text-sm line-through"
                                        : "text-sm font-medium hover:underline"
                                    }
                                  >
                                    {task.title}
                                  </p>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                No step by step breakdown is available for this project yet.
              </p>
            )}
          </section>

          {project.readmeOutline.length > 0 && (
            <section className="panel hover-lift p-6">
              <h2 className="font-display text-lg font-semibold">Documentation outline</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Structure your project README (or written summary) around these sections.
              </p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
                {project.readmeOutline.map((section) => (
                  <li key={section}>{section}</li>
                ))}
              </ol>
            </section>
          )}

          {project.resources.length > 0 && (
            <section className="panel hover-lift p-6">
              <h2 className="font-display text-lg font-semibold">Learning resources</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Free, real resources for the skills this project uses.
              </p>
              <ul className="mt-3 space-y-2">
                {project.resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:bg-muted flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{resource.title}</span>
                        {resource.provider && (
                          <span className="text-muted-foreground"> · {resource.provider}</span>
                        )}
                      </span>
                      <ExternalLink className="text-muted-foreground size-4 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="panel hover-lift space-y-3 p-6">
            <h2 className="text-sm font-semibold">Progress</h2>

            {project.status === "started" && justStarted && (
              <div className="bg-success-soft border-success/20 space-y-2.5 rounded-xl border p-4">
                <p className="text-success flex items-center gap-1.5 text-sm font-semibold">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Project started
                </p>
                <p className="text-muted-foreground text-xs">
                  Your project is now in progress. Start with the first task and build your way
                  through each milestone.
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setJustStarted(false);
                    if (nextTask) setActiveTaskIndex(nextTask.index);
                  }}
                >
                  <Rocket className="size-3.5" />
                  Continue project
                </Button>
              </div>
            )}

            {project.status === "started" && !justStarted && totalTasks > 0 && (
              <p className="text-muted-foreground -mt-1 text-xs">
                {project.milestones[project.currentMilestoneIndex]?.isComplete
                  ? "All milestones complete"
                  : `Current: ${project.milestones[project.currentMilestoneIndex]?.label}`}{" "}
                · {completedCount}/{totalTasks} steps
              </p>
            )}
            {project.status === "not_started" && (
              <Button
                className="w-full"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("started")}
              >
                {isStarting && <Loader2 className="size-4 animate-spin" />}
                {isStarting ? "Starting project…" : "Start project"}
              </Button>
            )}
            {project.status === "started" && !justStarted && (
              <Button
                className="w-full"
                disabled={statusMutation.isPending || !nextTask}
                onClick={() => {
                  if (nextTask) setActiveTaskIndex(nextTask.index);
                }}
              >
                Continue project
              </Button>
            )}
            {project.status === "started" && !justStarted && (
              <Button
                variant="outline"
                className="w-full"
                disabled={statusMutation.isPending || !allTasksDone}
                onClick={() => statusMutation.mutate("completed")}
              >
                {isCompleting && <Loader2 className="size-4 animate-spin" />}
                {isCompleting ? "Marking complete…" : "Mark project complete"}
              </Button>
            )}
            {project.status === "started" && !justStarted && !allTasksDone && totalTasks > 0 && (
              <p className="text-muted-foreground text-xs">
                Finish all steps to mark the project complete.
              </p>
            )}
            {project.status !== "not_started" && (
              <Button
                variant="outline"
                className="w-full"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("not_started")}
              >
                Reset progress
              </Button>
            )}
            {project.status === "completed" && project.resumeBullet && (
              <Button variant="ghost" className="w-full" onClick={copyBullet}>
                {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
                Copy resume bullet
              </Button>
            )}
            {project.assessmentSlug && (
              <Button asChild variant="outline" className="w-full">
                <Link to="/assessments">
                  <ClipboardCheck className="size-3.5" />
                  Test yourself on these skills
                </Link>
              </Button>
            )}
          </section>

          {project.careerSlug && (
            <section className="panel hover-lift p-6">
              <h2 className="text-sm font-semibold">Connected to your roadmap</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                This project targets skills from the {project.careerTitle} skill profile.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/skills">View your skill gap</Link>
              </Button>
            </section>
          )}
        </aside>
      </div>

      <TaskWorkspaceDialog
        open={activeTask !== null}
        onOpenChange={(open) => {
          if (!open) setActiveTaskIndex(null);
        }}
        projectId={projectId}
        milestoneLabel={activeMilestone?.label ?? "Step"}
        task={activeTask}
      />
    </AppShell>
  );
}
