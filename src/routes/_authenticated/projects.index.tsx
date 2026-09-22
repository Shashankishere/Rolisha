import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Check, FolderGit2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProjects } from "@/lib/projects.functions";
import type { ProjectListItem } from "@/lib/projects.server";

const projectsQuery = queryOptions({ queryKey: ["projects"], queryFn: () => getProjects() });

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const Route = createFileRoute("/_authenticated/projects/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
  head: () => ({
    meta: [{ title: "Projects — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="projects.index"
      title="Projects unavailable"
      description="Please refresh to try again."
    />
  ),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects } = useSuspenseQuery(projectsQuery);

  return (
    <AppShell
      title="Projects"
      description="Open a project to see its objective, required skills and a step by step build plan. Track progress as you go and pick up where you left off."
    >
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects available yet"
          description="Check back soon — new projects are added regularly."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project, i) => (
            <Reveal key={project.id} delay={Math.min(i * 50, 300)} className="h-full">
              <ProjectCard project={project} />
            </Reveal>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ProjectCard({ project }: { project: ProjectListItem }) {
  // Real progress from the project's own checklist, not a fixed
  // "started = 60%" stage guess — a freshly-started project with 0 of 4
  // steps done now genuinely shows 0%, not a canned number.
  const stagePercent =
    project.status === "completed"
      ? 100
      : project.totalTaskCount > 0
        ? Math.round((project.completedTaskCount / project.totalTaskCount) * 100)
        : project.status === "started"
          ? 0
          : 0;

  return (
    <div className="panel hover-lift flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{project.title}</h2>
            {project.isRecommended && (
              <Badge className="bg-primary-soft text-primary gap-1 border-none">
                <Sparkles className="size-3" />
                For your career
              </Badge>
            )}
          </div>
          {project.summary && (
            <p className="text-muted-foreground mt-1.5 text-sm">{project.summary}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">
          {DIFFICULTY_LABEL[project.difficulty] ?? project.difficulty}
        </Badge>
        <Badge variant="outline">{project.estimatedHours}h estimated</Badge>
        {project.status === "started" && <Badge variant="secondary">In progress</Badge>}
        {project.status === "completed" && (
          <Badge className="bg-success-soft text-success gap-1 border-none">
            <Check className="size-3" />
            Completed
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-brand-gradient animate-progress-fill h-full rounded-full transition-[width] duration-500"
            style={{ width: `${stagePercent}%` }}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-[11px]">
          {project.status === "not_started"
            ? "Not started"
            : project.status === "completed"
              ? "Done"
              : project.totalTaskCount > 0
                ? `${project.completedTaskCount}/${project.totalTaskCount} steps`
                : "In progress"}
        </span>
      </div>

      {project.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {project.skills.map((skill) => (
            <li key={skill} className="bg-muted rounded-full px-2.5 py-1 text-xs">
              {skill}
            </li>
          ))}
        </ul>
      )}

      <Button asChild size="sm" className="mt-auto">
        <Link to="/projects/$projectId" params={{ projectId: project.id }}>
          {project.status === "not_started" ? "Open project" : "Continue project"}
        </Link>
      </Button>
    </div>
  );
}
