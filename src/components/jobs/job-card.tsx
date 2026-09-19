import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bookmark, BookmarkCheck, Building2, Check, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WORK_MODE_LABEL } from "@/lib/domain";
import { formatJobSalary } from "@/lib/jobs/salary-display";
import type { JobListItem } from "@/lib/jobs/explorer-types";

/** Placeholder matching JobCard's real proportions, shown while a jobs
 * query is loading — replaces bare "Loading…" text with a layout-stable
 * skeleton so the page doesn't visually jump once real cards arrive. */
export function JobCardSkeleton() {
  return (
    <div className="panel flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/5" />
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

function relativeFromNow(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Posted ${months} month${months > 1 ? "s" : ""} ago`;
  return "Posted over a year ago";
}

export function JobCard({
  job,
  onToggleSave,
  isSaving,
}: {
  job: JobListItem;
  onToggleSave: (job: JobListItem) => void;
  isSaving: boolean;
}) {
  const salary = formatJobSalary(job);
  const location = job.location ?? "Location not specified";
  const posted = relativeFromNow(job.postedAt);
  const topMissing = job.missingSkills.slice(0, 3);
  const topMatched = job.matchedSkills.slice(0, 3);

  return (
    <div className="panel hover-lift flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: job.id }}
            className="text-base font-semibold hover:underline"
          >
            {job.title}
          </Link>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5 shrink-0" />
              {job.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {location}
              {job.workMode && ` · ${WORK_MODE_LABEL[job.workMode]}`}
            </span>
          </div>
        </div>
        {job.match && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="relative grid size-11 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--primary) ${job.match.overall}%, var(--muted) 0)`,
              }}
              aria-hidden="true"
            >
              <div className="bg-card grid size-8.5 place-items-center rounded-full text-[10px] font-semibold tabular-nums">
                {job.match.overall}%
              </div>
            </div>
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              Match
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{salary}</span>
        {posted && <span className="text-muted-foreground text-xs">· {posted}</span>}
        {!job.isDemo && (
          <Badge variant="default" className="ml-auto">
            Live job
          </Badge>
        )}
      </div>

      {(topMatched.length > 0 || topMissing.length > 0) && (
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {topMatched.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {topMatched.map((s) => (
                <span
                  key={s.id}
                  className="bg-success-soft text-success inline-flex items-center gap-1 rounded-full px-2 py-1"
                >
                  <Check className="size-3" /> {s.name}
                </span>
              ))}
            </div>
          )}
          {topMissing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {topMissing.map((s) => (
                <span
                  key={s.id}
                  className="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full px-2 py-1"
                >
                  <AlertTriangle className="size-3" /> {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button asChild size="sm">
          <Link to="/jobs/$jobId" params={{ jobId: job.id }}>
            View Job
          </Link>
        </Button>
        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => onToggleSave(job)}>
          {job.isSaved ? (
            <>
              <BookmarkCheck className="size-4" /> Saved
            </>
          ) : (
            <>
              <Bookmark className="size-4" /> Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
