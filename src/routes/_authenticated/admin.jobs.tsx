import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { AdminAccessFallback } from "@/components/admin/admin-access-fallback";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  cleanupDemoJobs,
  getAdzunaStatus,
  getAdzunaSyncRuns,
  getLiveSearchHistory,
  ingestAdzunaJobs,
} from "@/lib/jobs.functions";
import type { SyncRunView } from "@/lib/jobs.functions";

function adzunaStatusQuery() {
  return queryOptions({
    queryKey: ["admin", "adzuna-status"],
    queryFn: () => getAdzunaStatus(),
  });
}

function adzunaSyncRunsQuery() {
  return queryOptions({
    queryKey: ["admin", "adzuna-sync-runs"],
    queryFn: () => getAdzunaSyncRuns(),
  });
}

function liveSearchHistoryQuery() {
  return queryOptions({
    queryKey: ["admin", "adzuna-live-searches"],
    queryFn: () => getLiveSearchHistory(),
  });
}

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(adzunaStatusQuery()),
      context.queryClient.ensureQueryData(adzunaSyncRunsQuery()),
      context.queryClient.ensureQueryData(liveSearchHistoryQuery()),
    ]),
  head: () => ({
    meta: [{ title: "Job ingestion — Rolisha admin" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <AdminAccessFallback error={error} reset={reset} routeId="admin.jobs" title="Job ingestion" />
  ),
  component: AdminJobsPage,
});

type IngestSummary = Awaited<ReturnType<typeof ingestAdzunaJobs>>;

const SCHEDULE_LABEL: Record<"daily" | "hourly", string> = {
  daily: "Daily (00:00 UTC)",
  hourly: "Hourly (top of every hour)",
};

function AdminJobsPage() {
  const { data: status } = useSuspenseQuery(adzunaStatusQuery());
  const { data: syncHistory } = useSuspenseQuery(adzunaSyncRunsQuery());
  const { data: liveSearchHistory } = useSuspenseQuery(liveSearchHistoryQuery());
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("in");
  const [maxJobs, setMaxJobs] = useState(10);
  const [summary, setSummary] = useState<IngestSummary | null>(null);

  const ingestMutation = useMutation({
    mutationFn: () =>
      ingestAdzunaJobs({
        data: {
          query: query.trim() || undefined,
          location: location.trim() || undefined,
          country: country.trim() || undefined,
          maxJobs,
        },
      }),
    onSuccess: (result) => {
      setSummary(result);
      toast.success(`Synced ${result.fetched} job${result.fetched === 1 ? "" : "s"} from Adzuna.`);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "adzuna-sync-runs"] });
    },
    onError: (error: Error) => toast.error(error.message || "Sync failed."),
  });

  const cleanupMutation = useMutation({
    mutationFn: () => cleanupDemoJobs(),
    onSuccess: (result) => {
      if (result.skipped) {
        toast.error(result.reason);
        return;
      }
      toast.success(`Removed ${result.removed} seeded job${result.removed === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not remove seeded jobs."),
  });

  const latestRun: SyncRunView | undefined = syncHistory.runs[0];

  return (
    <AppShell
      title="Job ingestion"
      description="Jobs reach the Jobs Explorer three ways: the daily scheduled sync, a manual sync triggered here, or an on demand live search when a user's query or location doesn't already have enough fresh matches. This page is for monitoring and troubleshooting all three; it's no longer the only way new locations become available."
      actions={
        <Badge variant={status.configured ? "default" : "outline"}>
          Adzuna: {status.configured ? "Configured" : "Not configured"}
        </Badge>
      }
    >
      <AdminSubNav />
      {!status.configured ? (
        <div className="panel hover-lift p-6 text-sm text-muted-foreground">
          Adzuna is not configured. Set <code>ADZUNA_APP_ID</code> and <code>ADZUNA_APP_KEY</code>{" "}
          (or the <code>ADZUNA_API_KEY</code> alias) as server environment variables to enable live
          sync.
        </div>
      ) : null}

      <div className="panel hover-lift space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">Scheduled &amp; manual sync</h2>
          <Badge variant="outline">{SCHEDULE_LABEL[status.scheduleLabel]}</Badge>
        </div>

        {!syncHistory.available && (
          <div className="border-warning/40 bg-warning-soft/40 text-warning flex items-start gap-2 rounded-lg border p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Ingestion history is currently unavailable.</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{syncHistory.errorMessage}</p>
            </div>
          </div>
        )}

        {syncHistory.available && !latestRun ? (
          <p className="text-muted-foreground text-sm">
            No automatic or manual sync has run yet. Trigger one below, or wait for the next
            scheduled run.
          </p>
        ) : null}
        {latestRun && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              {latestRun.status === "success" ? (
                <CheckCircle2 className="text-success size-4" />
              ) : latestRun.status === "failed" ? (
                <XCircle className="text-destructive size-4" />
              ) : (
                <Clock className="text-muted-foreground size-4" />
              )}
              <span className="font-medium">
                {latestRun.status === "success"
                  ? "Healthy"
                  : latestRun.status === "failed"
                    ? "Last sync failed"
                    : "Running"}
              </span>
            </span>
            <span className="text-muted-foreground">
              Last {latestRun.trigger === "manual" ? "manual" : "automatic"} sync:{" "}
              {new Date(latestRun.startedAt).toLocaleString()}
            </span>
            {latestRun.status === "success" && (
              <span className="text-muted-foreground">
                {latestRun.insertedCount} inserted · {latestRun.updatedCount} updated ·{" "}
                {latestRun.deactivatedCount} marked inactive
              </span>
            )}
            {latestRun.status === "failed" && latestRun.errorMessage && (
              <span className="text-destructive">{latestRun.errorMessage}</span>
            )}
          </div>
        )}

        {syncHistory.runs.length > 1 && (
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer select-none">
              Recent sync history ({syncHistory.runs.length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {syncHistory.runs.map((run) => (
                <li key={run.id} className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                  <span className="w-40 shrink-0">{new Date(run.startedAt).toLocaleString()}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {run.trigger}
                  </Badge>
                  <span
                    className={
                      run.status === "failed"
                        ? "text-destructive"
                        : run.status === "success"
                          ? "text-success"
                          : ""
                    }
                  >
                    {run.status}
                  </span>
                  {run.status === "success" && (
                    <span>
                      fetched {run.fetchedCount} / inserted {run.insertedCount} / updated{" "}
                      {run.updatedCount}
                    </span>
                  )}
                  {run.status === "failed" && run.errorMessage && <span>{run.errorMessage}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="panel hover-lift space-y-4 p-6">
        <h2 className="font-display text-base font-semibold">Sync now (manual)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adzuna-query">Search / query</Label>
            <Input
              id="adzuna-query"
              placeholder="e.g. data analyst"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adzuna-location">Location</Label>
            <Input
              id="adzuna-location"
              placeholder="e.g. London"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adzuna-country">Country</Label>
            <Input
              id="adzuna-country"
              placeholder="us"
              maxLength={2}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adzuna-max-jobs">Maximum jobs</Label>
            <Input
              id="adzuna-max-jobs"
              type="number"
              min={1}
              max={50}
              value={maxJobs}
              onChange={(e) => setMaxJobs(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <Button
          onClick={() => ingestMutation.mutate()}
          disabled={!status.configured || ingestMutation.isPending}
        >
          {ingestMutation.isPending ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {summary ? (
        <div className="panel hover-lift overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Last manual sync summary</caption>
            <tbody>
              {(
                [
                  ["Fetched", summary.fetched],
                  ["Inserted", summary.inserted],
                  ["Updated", summary.updated],
                  ["Skipped", summary.skipped],
                  ["Failed records", summary.failed],
                  ["Marked inactive", summary.deactivated],
                  ["Duration (ms)", summary.durationMs],
                ] as const
              ).map(([label, value]) => (
                <tr key={label} className="border-border/70 border-t first:border-t-0">
                  <th scope="row" className="px-5 py-3 text-left font-medium">
                    {label}
                  </th>
                  <td className="px-5 py-3 text-right tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="panel hover-lift space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            <Search className="size-4" />
            On demand user search (live)
          </h2>
          <Badge variant="outline">Triggered automatically</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          When a Jobs Explorer search doesn't already have enough fresh matches in Supabase, the
          server searches Adzuna directly for that query/location and caches the results. Recent
          triggers:
        </p>
        {!liveSearchHistory.available && (
          <div className="border-warning/40 bg-warning-soft/40 text-warning flex items-start gap-2 rounded-lg border p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{liveSearchHistory.errorMessage}</p>
          </div>
        )}
        {liveSearchHistory.available && liveSearchHistory.entries.length === 0 && (
          <p className="text-muted-foreground text-sm">No on demand searches have run yet.</p>
        )}
        {liveSearchHistory.available && liveSearchHistory.entries.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {liveSearchHistory.entries.map((entry) => (
              <li key={entry.id} className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                <span className="w-40 shrink-0">{new Date(entry.searchedAt).toLocaleString()}</span>
                <span>
                  "{entry.query || "any"}" in {entry.location || "any location"}
                  {entry.country ? ` (${entry.country.toUpperCase()})` : ""}
                </span>
                <span>— {entry.jobsFound} job(s) found</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel hover-lift space-y-3 p-6">
        <h2 className="font-display text-base font-semibold">Seeded listings cleanup</h2>
        <p className="text-muted-foreground text-sm">
          The Jobs Explorer was seeded with sample postings (internally flagged{" "}
          <code>is_demo = true</code>) so it wasn't empty before live data existed. Once real Adzuna
          jobs are confirmed present, remove the seeded rows so production never shows them as live.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={cleanupMutation.isPending}>
              Remove seeded listings
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove all seeded listings?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes every job marked as seeded sample data. It's refused
                automatically if no live (non seeded, active) jobs exist yet, so the Jobs Explorer
                is never left empty.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => cleanupMutation.mutate()}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
