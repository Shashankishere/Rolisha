import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { getIsAdmin } from "@/lib/me.functions";
import {
  JOBS_COPY,
  dataModeBadge,
  emptyStateCopy,
  resolveJobsListView,
  sampleNoticeText,
  shouldShowSampleDataNotice,
} from "@/lib/jobs/list-state";
import { hasMixedSalaryCurrencies } from "@/lib/jobs/salary-display";
import { toast } from "sonner";
import { AlertTriangle, Filter, Loader2, Search, SearchX } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { Reveal } from "@/components/app/reveal";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { JobCard, JobCardSkeleton } from "@/components/jobs/job-card";
import { JobFiltersPanel } from "@/components/jobs/job-filters-panel";
import { AlmostQualifiedCard } from "@/components/jobs/almost-qualified-card";
import { listCareers, listSkills } from "@/lib/catalog.functions";
import { addMissingSkillsToRoadmap, listJobs, saveJob, unsaveJob } from "@/lib/jobs.functions";
import {
  DEFAULT_JOB_FILTERS,
  type JobFilters,
  type JobListItem,
  type JobSortOption,
} from "@/lib/jobs/explorer-types";
import { shouldSubmitJobSearch } from "@/lib/jobs/job-search-submit";

const SORT_LABEL: Record<JobSortOption, string> = {
  best_match: "Best Match",
  newest: "Newest",
  salary_desc: "Salary: High → Low",
  salary_asc: "Salary: Low → High",
};

const searchSchema = z.object({
  q: z.string().optional(),
  career: z.string().optional(),
  loc: z.string().optional(),
  mode: z.enum(["remote", "hybrid", "onsite", "any"]).optional(),
  smin: z.number().optional(),
  smax: z.number().optional(),
  exp: z.enum(["entry", "junior", "mid", "senior"]).optional(),
  skills: z.string().optional(),
  sort: z.enum(["best_match", "newest", "salary_desc", "salary_asc"]).optional(),
  page: z.number().int().min(1).optional(),
});

type JobsSearch = z.infer<typeof searchSchema>;

function filtersFromSearch(search: JobsSearch): JobFilters {
  return {
    search: search.q ?? "",
    careerId: search.career ?? null,
    location: search.loc ?? "",
    workMode: search.mode ?? "any",
    salaryMin: search.smin ?? null,
    salaryMax: search.smax ?? null,
    experience: search.exp ?? null,
    skillIds: search.skills ? search.skills.split(",").filter(Boolean) : [],
  };
}

function searchFromFilters(filters: JobFilters, sort: JobSortOption, page: number): JobsSearch {
  return {
    q: filters.search || undefined,
    career: filters.careerId ?? undefined,
    loc: filters.location || undefined,
    mode: filters.workMode !== "any" ? filters.workMode : undefined,
    smin: filters.salaryMin ?? undefined,
    smax: filters.salaryMax ?? undefined,
    exp: filters.experience ?? undefined,
    skills: filters.skillIds.length ? filters.skillIds.join(",") : undefined,
    sort: sort !== "best_match" ? sort : undefined,
    page: page > 1 ? page : undefined,
  };
}

const catalogQuery = queryOptions({
  queryKey: ["jobs-explorer-catalog"],
  queryFn: async () => ({ careers: await listCareers(), skills: await listSkills() }),
  // Careers and skills are catalog reference data that changes rarely (admin
  // edits, not user actions), so there's no reason to refetch it every time
  // the Jobs page regains focus.
  staleTime: 5 * 60_000,
});

function jobsQuery(filters: JobFilters, sort: JobSortOption, page: number) {
  return queryOptions({
    queryKey: ["jobs", filters, sort, page],
    queryFn: () =>
      listJobs({
        data: {
          search: filters.search,
          careerId: filters.careerId,
          location: filters.location,
          workMode: filters.workMode,
          salaryMin: filters.salaryMin,
          salaryMax: filters.salaryMax,
          experience: filters.experience,
          skillIds: filters.skillIds,
          sort,
          page,
          pageSize: 12,
        },
      }),
    placeholderData: keepPreviousData,
    // Job listings don't change second-to-second (live Adzuna search itself
    // has a 10-minute cooldown per query), so a short staleTime avoids a
    // redundant Supabase round trip — and the loading flicker that comes
    // with it — every time this query becomes active again (window focus,
    // navigating to a job and back) with the same filters/sort/page.
    staleTime: 30_000,
  });
}

function almostQualifiedQuery(filters: JobFilters) {
  return queryOptions({
    queryKey: ["jobs-almost-qualified", filters.careerId, filters.location, filters.workMode],
    queryFn: () =>
      listJobs({
        data: {
          careerId: filters.careerId,
          location: filters.location,
          workMode: filters.workMode,
          sort: "best_match",
          page: 1,
          pageSize: 40,
        },
      }),
    staleTime: 30_000,
  });
}

export const Route = createFileRoute("/_authenticated/jobs/")({
  validateSearch: (search) => searchSchema.parse(search),
  // NOTE: deliberately no `loaderDeps` here. The loader below only warms
  // `catalogQuery` (careers + skills reference data), which never depends
  // on the filters in `search` -- it was previously declared as
  // `loaderDeps: ({ search }) => search`, which made TanStack Router treat
  // EVERY filter change (typing in the salary field, picking a career,
  // changing sort, paging) as a brand new set of loader dependencies. That
  // forced a full loader re-run and, with it, the router's pending state
  // swapping out this route's entire component -- sidebar included, since
  // `AppShell` is rendered inside `JobsExplorerPage` rather than a parent
  // layout route -- for a blank page on every keystroke, instead of the
  // in-place "Searching..." skeleton the results panel already shows via
  // `useQuery`. Filters are read reactively from `Route.useSearch()` in the
  // component below and drive `jobsQuery` there, entirely independent of
  // this loader, so the loader genuinely only needs to run once per mount.
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({ meta: [{ title: "Jobs — Rolisha" }, { name: "robots", content: "noindex" }] }),
  component: JobsExplorerPage,
});

function JobsExplorerPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const isDefaultFilters = useMemo(
    () => JSON.stringify(filters) === JSON.stringify(DEFAULT_JOB_FILTERS),
    [filters],
  );
  const sort = search.sort ?? "best_match";
  const page = search.page ?? 1;

  const [searchInput, setSearchInput] = useState(filters.search);
  const [locationInput, setLocationInput] = useState(filters.location);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Submission lock: set synchronously on submit, cleared once the jobs
  // query is no longer fetching. Prevents a fast double Enter/click (or
  // Enter immediately followed by clicking Search) from firing a second,
  // duplicate request while the first is still in flight.
  const submitLockRef = useRef(false);

  useEffect(() => setSearchInput(filters.search), [filters.search]);
  useEffect(() => setLocationInput(filters.location), [filters.location]);

  function submitSearch() {
    const pending = { search: searchInput, location: locationInput };
    const applied = { search: filters.search, location: filters.location };
    if (!shouldSubmitJobSearch(pending, applied, submitLockRef.current)) return;
    submitLockRef.current = true;
    updateFilters({ ...filters, ...pending }, sort, 1);
  }

  function updateFilters(next: JobFilters, nextSort: JobSortOption, nextPage: number) {
    navigate({ search: searchFromFilters(next, nextSort, nextPage) });
  }

  const { data: catalog } = useSuspenseQuery(catalogQuery);
  const jobsResult = useQuery(jobsQuery(filters, sort, page));
  const almostQualified = useQuery(almostQualifiedQuery(filters));

  // Release the submit lock once the query that submitSearch() triggered has
  // finished (succeeded or failed) — the button/Enter become usable again.
  useEffect(() => {
    if (!jobsResult.isFetching) submitLockRef.current = false;
  }, [jobsResult.isFetching]);

  const saveMutation = useMutation({
    mutationFn: ({ job }: { job: JobListItem }) =>
      job.isSaved ? unsaveJob({ data: { jobId: job.id } }) : saveJob({ data: { jobId: job.id } }),
    onSuccess: (_result, { job }) => {
      toast.success(job.isSaved ? "Removed from saved jobs." : "Job saved.");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs-almost-qualified"] });
      queryClient.invalidateQueries({ queryKey: ["job"] });
    },
    onError: () => toast.error("Could not update this job."),
  });

  const addToRoadmapMutation = useMutation({
    mutationFn: (job: JobListItem) =>
      addMissingSkillsToRoadmap({
        data: { jobId: job.id, skillIds: job.missingSkills.map((s) => s.id) },
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

  const jobs = jobsResult.data?.jobs ?? [];

  // Same cached query the app shell uses. Only decides whether the "connect a
  // live source" hint is shown: it is an admin action, meaningless to customers.
  const isAdminQuery = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => getIsAdmin(),
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = isAdminQuery.data === true;
  const dataMode = jobsResult.data?.dataMode;
  const listView = resolveJobsListView({ jobCount: jobs.length, dataMode });
  const badge = dataModeBadge(dataMode);
  const showMixedCurrencyNote = hasMixedSalaryCurrencies(jobs);
  const almostQualifiedJobs = (almostQualified.data?.jobs ?? [])
    .filter(
      (j) =>
        j.match &&
        j.match.overall >= 65 &&
        j.match.overall < 95 &&
        j.missingSkills.length > 0 &&
        j.missingSkills.length <= 2,
    )
    .slice(0, 3);

  const filtersPanel = (
    <JobFiltersPanel
      filters={filters}
      locationInput={locationInput}
      onLocationInputChange={setLocationInput}
      onSubmitSearch={submitSearch}
      careers={catalog.careers}
      skills={catalog.skills}
      onChange={(next) => updateFilters(next, sort, 1)}
      onClear={() => {
        setSearchInput("");
        setLocationInput("");
        updateFilters(DEFAULT_JOB_FILTERS, sort, 1);
      }}
    />
  );

  return (
    <AppShell
      title="Jobs you can target"
      description="Compare real job requirements with your current skills."
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="panel hover-lift p-5">{filtersPanel}</div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Search jobs, companies, or skills..."
                aria-label="Search jobs, companies, or skills"
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              onClick={submitSearch}
              disabled={jobsResult.isFetching}
              className="shrink-0"
            >
              {jobsResult.isFetching && <Loader2 className="size-4 animate-spin" />}
              Search
            </Button>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <Filter className="size-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">{filtersPanel}</div>
              </SheetContent>
            </Sheet>

            <select
              aria-label="Sort by"
              className="border-input bg-transparent dark:bg-white/[0.04] text-foreground h-9 rounded-lg border px-3 text-sm"
              value={sort}
              onChange={(e) => updateFilters(filters, e.target.value as JobSortOption, 1)}
            >
              {(Object.keys(SORT_LABEL) as JobSortOption[]).map((option) => (
                <option className="bg-popover text-popover-foreground" key={option} value={option}>
                  {SORT_LABEL[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-sm">
              {jobsResult.isLoading
                ? "Searching…"
                : jobsResult.isFetching
                  ? `Updating results… (showing ${jobsResult.data?.total ?? 0} previous match${jobsResult.data?.total === 1 ? "" : "es"})`
                  : `${jobsResult.data?.total ?? 0} jobs found`}
            </p>
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            {jobsResult.data?.scoredSubsetOnly && (
              <span className="text-muted-foreground text-xs">
                Best Match is scored against the most recent {jobsResult.data.total} postings.
              </span>
            )}
          </div>

          {shouldShowSampleDataNotice(dataMode) && (
            <p className="text-muted-foreground -mt-1 flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5 shrink-0" />
              {sampleNoticeText(isAdmin)}
            </p>
          )}

          {showMixedCurrencyNote && (
            <p className="text-muted-foreground -mt-1 text-xs">{JOBS_COPY.mixedCurrencyNote}</p>
          )}

          {jobsResult.data?.liveSearch?.triggered && !jobsResult.data.liveSearch.errorMessage && (
            <p className="text-muted-foreground -mt-1 flex items-center gap-1.5 text-xs">
              <Search className="size-3.5 shrink-0" />
              {jobsResult.data.liveSearch.jobsFound > 0
                ? JOBS_COPY.liveSearchFound(jobsResult.data.liveSearch.jobsFound)
                : JOBS_COPY.liveSearchNone}
            </p>
          )}
          {jobsResult.data?.liveSearch?.errorMessage && (
            <p className="text-muted-foreground -mt-1 flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5 shrink-0" />
              {JOBS_COPY.liveSearchUnavailable}
            </p>
          )}

          {almostQualifiedJobs.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold">Almost Qualified</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {almostQualifiedJobs.map((job) => (
                  <AlmostQualifiedCard
                    key={job.id}
                    job={job}
                    isAdding={addToRoadmapMutation.isPending}
                    onAddToRoadmap={(j) => addToRoadmapMutation.mutate(j)}
                  />
                ))}
              </div>
            </section>
          )}

          {jobsResult.isError && (
            <EmptyState
              icon={AlertTriangle}
              tone="error"
              title="Unable to load jobs."
              action={
                <Button variant="outline" size="sm" onClick={() => jobsResult.refetch()}>
                  Retry
                </Button>
              }
            />
          )}

          {!jobsResult.isError && !jobsResult.isLoading && listView !== "results" && (
            <EmptyState
              icon={SearchX}
              {...emptyStateCopy({
                view: listView,
                liveSearchTriggered: jobsResult.data?.liveSearch?.triggered === true,
                liveSearchFailed: Boolean(jobsResult.data?.liveSearch?.errorMessage),
                isAdmin,
              })}
              action={
                isDefaultFilters ? undefined : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateFilters(DEFAULT_JOB_FILTERS, sort, 1)}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          )}

          {jobsResult.isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!jobsResult.isLoading && jobs.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job, i) => (
                <Reveal key={job.id} delay={Math.min(i * 40, 240)} className="h-full">
                  <JobCard
                    job={job}
                    isSaving={saveMutation.isPending}
                    onToggleSave={(j) => saveMutation.mutate({ job: j })}
                  />
                </Reveal>
              ))}
            </div>
          )}

          {jobsResult.data && jobsResult.data.pageCount > 1 && (
            <Pager
              page={page}
              pageCount={jobsResult.data.pageCount}
              onChange={(nextPage) => updateFilters(filters, sort, nextPage)}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(pageCount, windowStart + 4);
  const numbers = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-2">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      {windowStart > 1 && <span className="text-muted-foreground px-1 text-sm">…</span>}
      {numbers.map((n) => (
        <Button
          key={n}
          variant={n === page ? "outline" : "ghost"}
          size="sm"
          onClick={() => onChange(n)}
        >
          {n}
        </Button>
      ))}
      {windowEnd < pageCount && <span className="text-muted-foreground px-1 text-sm">…</span>}
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
