import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobListItem } from "@/lib/jobs/explorer-types";

export function AlmostQualifiedCard({
  job,
  onAddToRoadmap,
  isAdding,
}: {
  job: JobListItem;
  onAddToRoadmap: (job: JobListItem) => void;
  isAdding: boolean;
}) {
  const missing = job.missingSkills;
  return (
    <div className="panel flex h-full flex-col gap-3 p-5">
      <p className="text-muted-foreground text-sm">
        You&apos;re {missing.length === 1 ? "one skill" : `${missing.length} skills`} away from this
        job.
      </p>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: job.id }}
            className="font-semibold hover:underline"
          >
            {job.title}
          </Link>
          <p className="text-muted-foreground text-sm">{job.company}</p>
        </div>
        {job.match && (
          <span className="bg-primary/15 text-primary shrink-0 rounded-full px-3 py-1 text-sm font-semibold">
            {job.match.overall}% Match
          </span>
        )}
      </div>
      {missing.length > 0 && (
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Missing
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {missing.map((s) => (
              <li
                key={s.id}
                className="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              >
                <AlertTriangle className="size-3" /> {s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="mt-auto self-start"
          disabled={isAdding}
          onClick={() => onAddToRoadmap(job)}
        >
          {missing.length === 1
            ? `Add ${missing[0]!.name} to Roadmap`
            : "Add missing skills to Roadmap"}
        </Button>
      )}
    </div>
  );
}
