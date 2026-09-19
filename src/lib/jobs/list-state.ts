/**
 * What the Jobs page should tell the customer, decided in one pure place.
 *
 * Three situations must never be confused (they previously were, because the
 * "no live source" signal was derived from the FILTERED result set):
 *
 *   results            jobs came back                      -> show them
 *   no_matches         a live source feeds the catalogue,  -> "No jobs match your
 *                      but nothing matches these filters      current filters." + reset
 *   source_unavailable there is no live job anywhere        -> live-source message
 *                      (catalogue empty or demo-only)
 *
 * `dataMode` is a property of the whole active catalogue (see JobListResult),
 * so a search that matches nothing lands in `no_matches`, never in
 * `source_unavailable`.
 */
import type { JobListResult } from "@/lib/jobs/explorer-types";

export type JobsDataMode = JobListResult["dataMode"];
export type JobsListView = "results" | "no_matches" | "source_unavailable";

export function resolveJobsListView(input: {
  jobCount: number;
  dataMode: JobsDataMode | undefined;
}): JobsListView {
  if (input.jobCount > 0) return "results";
  return input.dataMode === "demo" ? "source_unavailable" : "no_matches";
}

/** Sample-data messaging is only ever appropriate when NO live job exists. */
export function shouldShowSampleDataNotice(dataMode: JobsDataMode | undefined): boolean {
  return dataMode === "demo";
}

/** Catalogue-level badge. "mixed" shows none: each live card carries its own
 * "Live job" marker, and a "Mixed sample & live data" label is development
 * status language that has no place once live data exists. */
export function dataModeBadge(
  dataMode: JobsDataMode | undefined,
): { label: string; variant: "outline" | "default" } | null {
  if (dataMode === "demo") return { label: "Sample job data", variant: "outline" };
  if (dataMode === "live") return { label: "Live job data", variant: "default" };
  return null;
}

export const JOBS_COPY = {
  noMatchesTitle: "No jobs match your current filters.",
  noMatchesHint: "Try a broader search or clear your filters.",
  liveSearchNoMatchTitle: "No matching jobs found for this search.",
  liveSearchNoMatchHint:
    "We searched live listings for this exact query and location and found nothing. Try a broader search or a nearby location.",
  liveSearchUnavailableHint:
    "Live search is temporarily unavailable, and there's no saved match for this search either. Try again shortly.",
  sourceUnavailableTitle: "Live job listings aren't available right now.",
  sourceUnavailableHint: "We're still bringing live postings online — please check back soon.",
  sourceUnavailableAdminHint:
    "Connect a live source from Job ingestion in Admin settings to populate this page.",
  sampleNotice: "You're viewing sample postings while live job listings come online.",
  sampleNoticeAdmin:
    "You're viewing sample postings. Connect a live source from Job ingestion in Admin settings.",
  liveSearchFound: (count: number) =>
    `Searched live listings for this query and found ${count} posting${count === 1 ? "" : "s"}.`,
  liveSearchNone: "Searched live listings for this query — no matching postings were returned.",
  liveSearchUnavailable:
    "Live search is temporarily unavailable. Showing the most recent listings we have.",
  mixedCurrencyNote: "Salaries are shown in each employer's listed currency.",
} as const;

export function sampleNoticeText(isAdmin: boolean): string {
  return isAdmin ? JOBS_COPY.sampleNoticeAdmin : JOBS_COPY.sampleNotice;
}

export function emptyStateCopy(input: {
  view: Exclude<JobsListView, "results">;
  liveSearchTriggered: boolean;
  liveSearchFailed: boolean;
  isAdmin: boolean;
}): { title: string; description: string } {
  if (input.view === "source_unavailable") {
    return {
      title: JOBS_COPY.sourceUnavailableTitle,
      description: input.isAdmin
        ? JOBS_COPY.sourceUnavailableAdminHint
        : JOBS_COPY.sourceUnavailableHint,
    };
  }
  if (input.liveSearchTriggered) {
    return {
      title: JOBS_COPY.liveSearchNoMatchTitle,
      description: input.liveSearchFailed
        ? JOBS_COPY.liveSearchUnavailableHint
        : JOBS_COPY.liveSearchNoMatchHint,
    };
  }
  return { title: JOBS_COPY.noMatchesTitle, description: JOBS_COPY.noMatchesHint };
}
