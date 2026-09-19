import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobMatchBreakdown } from "@/components/jobs/job-match-breakdown";
import { getJobDetail, addMissingSkillsToRoadmap, saveJob, unsaveJob } from "@/lib/jobs.functions";
import { WORK_MODE_LABEL } from "@/lib/domain";
import { formatJobSalary } from "@/lib/jobs/salary-display";
import { LockedBadge } from "@/components/app/upgrade-prompt";

function jobDetailQuery(jobId: string) {
  return queryOptions({
    queryKey: ["job", jobId],
    queryFn: () => getJobDetail({ data: { jobId } }),
  });
}

function relativeFromNow(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 30) return `Updated ${days} days ago`;
  return "Updated over a month ago";
}

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  loader: async ({ context, params }) => {
    const job = await context.queryClient.ensureQueryData(jobDetailQuery(params.jobId));
    if (!job) throw notFound();
    return job;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.title} at ${loaderData.company} — Rolisha`
          : "Job — Rolisha",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => (
    <AppShell title="Job not found" description="This posting may have been removed.">
      <Button asChild variant="outline" size="sm">
        <Link to="/jobs">
          <ArrowLeft className="size-4" /> Back to Jobs
        </Link>
      </Button>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="jobs.$jobId"
      title="Unable to load this job"
      description="Please refresh to try again."
    />
  ),
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const { data: job } = useSuspenseQuery(jobDetailQuery(jobId));
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () =>
      job!.isSaved ? unsaveJob({ data: { jobId } }) : saveJob({ data: { jobId } }),
    onSuccess: () => {
      toast.success(job!.isSaved ? "Removed from saved jobs." : "Job saved.");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-almost-qualified"] });
    },
    onError: () => toast.error("Could not update this job."),
  });

  const addToRoadmapMutation = useMutation({
    mutationFn: () =>
      addMissingSkillsToRoadmap({
        data: { jobId, skillIds: job!.missingSkills.map((s) => s.id) },
      }),
    onSuccess: (result) => {
      if (result.added.length > 0) {
        toast.success(`Added ${result.added.join(", ")} to your roadmap.`);
        queryClient.invalidateQueries({ queryKey: ["roadmap"] });
      } else {
        toast.info("Those skills are already on your roadmap.");
      }
    },
    onError: (error: Error) => toast.error(error.message || "Could not update your roadmap."),
  });

  if (!job) return null;

  const salary = formatJobSalary(job);

  const isAlmostQualified =
    job.match.overall >= 65 && job.match.overall < 95 && job.missingSkills.length > 0;

  return (
    <AppShell
      title={job.title}
      description={`${job.company} · ${job.location ?? "Location not specified"}`}
      breadcrumb={[{ label: "Jobs", to: "/jobs" }]}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center gap-2">
              {!job.isDemo && <Badge variant="default">Live job</Badge>}
              {job.workMode && <Badge variant="secondary">{WORK_MODE_LABEL[job.workMode]}</Badge>}
              <span className="text-muted-foreground text-xs">
                {relativeFromNow(job.retrievedAt)}
              </span>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Salary</dt>
                <dd className="font-medium">{salary}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Location</dt>
                <dd className="font-medium">{job.location ?? "Location not specified"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Posted</dt>
                <dd className="font-medium">
                  {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "Date not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Source</dt>
                <dd className="font-medium">{job.sourceName ?? "Unknown source"}</dd>
              </div>
            </dl>
          </section>

          {job.description && (
            <section className="panel p-6">
              <h2 className="font-display text-lg font-semibold">Description</h2>
              <p className="text-muted-foreground mt-3 whitespace-pre-line text-sm">
                {job.description}
              </p>
            </section>
          )}

          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold">Required skills</h2>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {job.requiredSkills.map((s) => (
                <li key={s.id} className="bg-muted rounded-full px-2.5 py-1 text-xs">
                  {s.name}
                </li>
              ))}
              {job.requiredSkills.length === 0 && (
                <li className="text-muted-foreground text-sm">No specific requirements listed.</li>
              )}
            </ul>
            {job.preferredSkills.length > 0 && (
              <>
                <h3 className="text-muted-foreground mt-5 text-xs font-medium uppercase tracking-wide">
                  Preferred skills
                </h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {job.preferredSkills.map((s) => (
                    <li
                      key={s.id}
                      className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs"
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {job.matchBreakdownLocked ? (
            <section className="panel flex flex-wrap items-center justify-between gap-3 p-6">
              <div>
                <h2 className="font-display text-lg font-semibold">Why you&apos;re a good match</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Overall match: <span className="font-medium">{job.match.overall}%</span>. See
                  exactly which skills matched and which are missing with Pro.
                </p>
              </div>
              <LockedBadge requiredPlan="pro" implemented />
            </section>
          ) : (
            <JobMatchBreakdown
              match={job.match}
              matchedSkills={job.matchedSkills}
              missingSkills={job.missingSkills}
            />
          )}

          {isAlmostQualified && (
            <section className="panel p-6">
              <h2 className="font-display text-lg font-semibold">Almost Qualified</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                You&apos;re{" "}
                {job.missingSkills.length === 1
                  ? "one skill"
                  : `${job.missingSkills.length} skills`}{" "}
                away from this job.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={addToRoadmapMutation.isPending}
                onClick={() => addToRoadmapMutation.mutate()}
              >
                {job.missingSkills.length === 1
                  ? `Add ${job.missingSkills[0]!.name} to Roadmap`
                  : "Add missing skills to Roadmap"}
              </Button>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="panel space-y-3 p-6">
            <Button
              className="w-full"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {job.isSaved ? (
                <>
                  <BookmarkCheck className="size-4" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="size-4" /> Save Job
                </>
              )}
            </Button>
            {job.sourceUrl ? (
              <Button className="w-full" asChild>
                <a href={job.sourceUrl} target="_blank" rel="noreferrer">
                  View Original Job <ExternalLink className="size-4" />
                </a>
              </Button>
            ) : (
              <p className="text-muted-foreground text-center text-xs">
                No original posting link is available for this job.
              </p>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
