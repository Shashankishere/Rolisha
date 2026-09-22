/**
 * Jobs Explorer — server-side listing.
 *
 * Search/location/work-mode/salary/experience/skill filters and the
 * "Newest"/"Salary" sorts run as real SQL, with `.range()` pagination, so the
 * browser never receives the whole `jobs` table.
 *
 * "Best Match" is the one exception: match score depends on the signed-in
 * user's profile, which isn't a column on `jobs`, so it can't be pushed down
 * to SQL. For that sort only, a bounded candidate pool (BEST_MATCH_CANDIDATE_CAP)
 * is fetched with the same filters applied, scored in memory with the
 * unmodified `scoreJobMatch()`, and paginated after sorting. `scoredSubsetOnly`
 * on the result tells the UI when that cap was actually hit, so it's never
 * silently wrong on a larger dataset.
 */
import {
  calculateJobMatchesBatch,
  loadJobsForMatch,
  type JobForMatch,
} from "@/lib/jobs/match.server";
import {
  EXPERIENCE_BAND_YEARS,
  type ExperienceBand,
  type JobDetail,
  type JobFilters,
  type JobListItem,
  type JobListResult,
  type JobSkillRef,
  type JobSortOption,
} from "@/lib/jobs/explorer-types";
import type { EducationLevel, WorkMode } from "@/lib/domain";
import type { PlanTier } from "@/lib/subscription";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/** Hard ceiling on how many jobs are ever pulled into memory to be scored for
 * "Best Match" sort (see module doc comment above). Exported so tests can
 * assert against the real value instead of a duplicated magic number, and so
 * it's obvious at a glance this can never accidentally become unbounded. */
export const BEST_MATCH_CANDIDATE_CAP = 300;

const JOB_LIST_COLUMNS =
  "id, title, company, location, country, work_mode, salary_min, salary_max, salary_currency, posted_at, retrieved_at, is_demo, source_url, job_sources(name)";

/** Finds skill IDs whose name matches the search term, for the "or skills" part of search. */
async function findSkillIdsByName(supabase: Client, term: string): Promise<string[]> {
  const { data } = await supabase.from("skills").select("id").ilike("name", `%${term}%`).limit(20);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Job IDs that require at least one of the given skill IDs. */
async function jobIdsForSkillIds(supabase: Client, skillIds: string[]): Promise<string[]> {
  if (skillIds.length === 0) return [];
  const { data } = await supabase
    .from("job_skills")
    .select("job_id")
    .in("skill_id", skillIds)
    .limit(2000);
  return [...new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id))];
}

/** Applies every non-search, non-skill filter to a query builder. Shared by
 * the data query and the two count queries so they can never drift apart. */
function applyScalarFilters(query: any, filters: JobFilters) {
  let q = query;
  // Prioritize current, active postings (Phase 3.5 stale-job handling) —
  // a job that hasn't shown up in a live sync recently is deactivated,
  // never deleted (see adzuna-sync-task.server.ts), so it's simply
  // excluded from search here rather than lost entirely.
  q = q.eq("is_active", true);
  if (filters.careerId) q = q.eq("career_id", filters.careerId);
  if (filters.location.trim()) q = q.ilike("location", `%${filters.location.trim()}%`);
  if (filters.workMode !== "any") q = q.eq("work_mode", filters.workMode);
  if (filters.salaryMin !== null) q = q.gte("salary_max", filters.salaryMin);
  if (filters.salaryMax !== null) q = q.lte("salary_min", filters.salaryMax);
  if (filters.experience) {
    const band = EXPERIENCE_BAND_YEARS[filters.experience];
    q = q.gte("experience_years_min", band.min);
    if (band.max !== null) q = q.lt("experience_years_min", band.max);
  }
  return q;
}

interface ResolvedSearch {
  matchingJobIds: string[] | null; // null = no search term
}

async function resolveSearch(supabase: Client, filters: JobFilters): Promise<ResolvedSearch> {
  const term = filters.search.trim();
  if (!term) return { matchingJobIds: null };
  const skillIds = await findSkillIdsByName(supabase, term);
  const jobIdsFromSkills = skillIds.length ? await jobIdsForSkillIds(supabase, skillIds) : [];
  return { matchingJobIds: jobIdsFromSkills };
}

function applySearch(query: any, term: string, jobIdsFromSkills: string[]) {
  const escaped = term.replace(/[%_,()]/g, "");
  const clauses = [`title.ilike.%${escaped}%`, `company.ilike.%${escaped}%`];
  if (jobIdsFromSkills.length) {
    clauses.push(`id.in.(${jobIdsFromSkills.join(",")})`);
  }
  return query.or(clauses.join(","));
}

function mapRow(
  row: any,
): Omit<JobListItem, "isSaved" | "match" | "matchedSkills" | "missingSkills"> {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    country: row.country,
    workMode: row.work_mode as WorkMode | null,
    salaryMin: row.salary_min === null ? null : Number(row.salary_min),
    salaryMax: row.salary_max === null ? null : Number(row.salary_max),
    salaryCurrency: row.salary_currency,
    postedAt: row.posted_at,
    retrievedAt: row.retrieved_at,
    isDemo: row.is_demo,
    sourceName: (row.job_sources as { name: string } | null)?.name ?? null,
  };
}

async function loadSkillNames(supabase: Client, skillIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (skillIds.length === 0) return map;
  const { data } = await supabase.from("skills").select("id, name").in("id", skillIds);
  for (const row of (data ?? []) as { id: string; name: string }[]) map.set(row.id, row.name);
  return map;
}

async function loadSavedJobIds(
  supabase: Client,
  userId: string | null,
  jobIds: string[],
): Promise<Set<string>> {
  if (!userId || jobIds.length === 0) return new Set();
  const { data } = await supabase
    .from("saved_jobs")
    .select("job_id")
    .eq("user_id", userId)
    .in("job_id", jobIds);
  return new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id));
}

export async function listJobsCore(
  supabase: Client,
  userId: string | null,
  filters: JobFilters,
  sort: JobSortOption,
  page: number,
  pageSize: number,
): Promise<JobListResult> {
  const { matchingJobIds } = await resolveSearch(supabase, filters);
  const searchTerm = filters.search.trim();

  const skillFilterJobIds =
    filters.skillIds.length > 0 ? await jobIdsForSkillIds(supabase, filters.skillIds) : null;

  function baseQuery() {
    let q = supabase.from("jobs").select(JOB_LIST_COLUMNS, { count: "exact" });
    q = applyScalarFilters(q, filters);
    if (searchTerm) q = applySearch(q, searchTerm, matchingJobIds ?? []);
    if (skillFilterJobIds) {
      q = q.in(
        "id",
        skillFilterJobIds.length ? skillFilterJobIds : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    return q;
  }

  function countOnlyQuery(extra?: (q: any) => any) {
    let q = supabase.from("jobs").select("id", { count: "exact", head: true });
    q = applyScalarFilters(q, filters);
    if (searchTerm) q = applySearch(q, searchTerm, matchingJobIds ?? []);
    if (skillFilterJobIds) {
      q = q.in(
        "id",
        skillFilterJobIds.length ? skillFilterJobIds : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    return extra ? extra(q) : q;
  }

  // `total` is the FILTERED count and drives pagination. `dataMode` is NOT
  // derived from it: it describes the whole active catalogue ("is a live
  // source feeding this product?"), so it comes from two UNFILTERED counts.
  // Deriving it from the filtered set was a bug -- any search or filter that
  // matched nothing reported "demo", which told customers they were looking
  // at sample postings and that an admin must connect a live source, even
  // when thousands of live jobs existed.
  const catalogCount = (onlyLive: boolean) => {
    let q = supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (onlyLive) q = q.eq("is_demo", false);
    return q;
  };
  const [{ count: totalCount }, { count: catalogTotalCount }, { count: catalogLiveCount }] =
    await Promise.all([countOnlyQuery(), catalogCount(false), catalogCount(true)]);
  const total = totalCount ?? 0;
  const catalogTotal = catalogTotalCount ?? 0;
  const catalogLive = catalogLiveCount ?? 0;
  const dataMode: JobListResult["dataMode"] =
    catalogLive === 0 ? "demo" : catalogLive === catalogTotal ? "live" : "mixed";

  let rows: any[] = [];
  let scoredSubsetOnly = false;
  let effectiveTotal = total;

  if (sort === "best_match") {
    const candidateTotal = Math.min(total, BEST_MATCH_CANDIDATE_CAP);
    scoredSubsetOnly = total > BEST_MATCH_CANDIDATE_CAP;
    effectiveTotal = candidateTotal;

    const { data, error } = await baseQuery()
      .order("posted_at", { ascending: false, nullsFirst: false })
      .range(0, BEST_MATCH_CANDIDATE_CAP - 1);
    if (error) throw new Error("Unable to load jobs right now.");
    const candidates = (data ?? []) as any[];

    if (userId) {
      const jobsForMatch = await loadJobsForMatch(
        supabase,
        candidates.map((c) => c.id),
      );
      const matches = await calculateJobMatchesBatch(supabase, userId, [
        ...jobsForMatch.values(),
      ] as JobForMatch[]);
      candidates.sort(
        (a, b) => (matches.get(b.id)?.overall ?? 0) - (matches.get(a.id)?.overall ?? 0),
      );
    }

    const from = (page - 1) * pageSize;
    rows = candidates.slice(from, from + pageSize);
  } else {
    let q = baseQuery();
    if (sort === "newest") q = q.order("posted_at", { ascending: false, nullsFirst: false });
    else if (sort === "salary_desc")
      q = q.order("salary_max", { ascending: false, nullsFirst: false });
    else if (sort === "salary_asc")
      q = q.order("salary_min", { ascending: true, nullsFirst: false });

    const from = (page - 1) * pageSize;
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error("Unable to load jobs right now.");
    rows = (data ?? []) as any[];
  }

  const jobIds = rows.map((r) => r.id);
  const [jobsForMatch, savedIds] = await Promise.all([
    loadJobsForMatch(supabase, jobIds),
    loadSavedJobIds(supabase, userId, jobIds),
  ]);

  const matches = userId
    ? await calculateJobMatchesBatch(supabase, userId, [...jobsForMatch.values()] as JobForMatch[])
    : new Map();

  const allSkillIds = new Set<string>();
  for (const job of jobsForMatch.values())
    for (const id of job.requiredSkillIds) allSkillIds.add(id);
  const skillNames = await loadSkillNames(supabase, [...allSkillIds]);

  const jobs: JobListItem[] = rows.map((row) => {
    const base = mapRow(row);
    const match = matches.get(row.id) ?? null;
    const matchedSkills: JobSkillRef[] = (match?.matchedSkillIds ?? []).map((id: string) => ({
      id,
      name: skillNames.get(id) ?? "Skill",
    }));
    const missingSkills: JobSkillRef[] = (match?.missingSkillIds ?? []).map((id: string) => ({
      id,
      name: skillNames.get(id) ?? "Skill",
    }));
    return {
      ...base,
      isSaved: savedIds.has(row.id),
      match,
      matchedSkills,
      missingSkills,
    };
  });

  return {
    jobs,
    total: effectiveTotal,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(effectiveTotal / pageSize)),
    dataMode,
    scoredSubsetOnly,
  };
}

export async function loadJobDetailCore(
  supabase: Client,
  userId: string | null,
  jobId: string,
  plan: PlanTier = "free",
): Promise<JobDetail | null> {
  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, title, company, location, country, work_mode, salary_min, salary_max, salary_currency, description, experience_years_min, education_requirement, posted_at, retrieved_at, is_demo, source_url, job_sources(name)",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this job.");
  if (!job) return null;

  const { data: jobSkillRows, error: skillsError } = await supabase
    .from("job_skills")
    .select("skill_id, is_required, skills(name)")
    .eq("job_id", jobId);
  if (skillsError) throw new Error("Unable to load this job's skills.");

  const required: JobSkillRef[] = [];
  const preferred: JobSkillRef[] = [];
  for (const row of (jobSkillRows ?? []) as any[]) {
    const ref: JobSkillRef = { id: row.skill_id, name: row.skills?.name ?? "Skill" };
    if (row.is_required) required.push(ref);
    else preferred.push(ref);
  }

  let match = {
    overall: 0,
    skills: 0,
    experience: 100,
    education: 100,
    location: 70,
    salary: 80,
    matchedSkillIds: [] as string[],
    missingSkillIds: required.map((r) => r.id),
  };
  let isSaved = false;

  if (userId) {
    const { calculateJobMatch } = await import("@/lib/jobs/match.server");
    match = await calculateJobMatch(supabase, userId, jobId);
    const { data: savedRow } = await supabase
      .from("saved_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .maybeSingle();
    isSaved = Boolean(savedRow);
  }

  const nameById = new Map<string, string>([...required, ...preferred].map((s) => [s.id, s.name]));
  const matchBreakdownLocked = plan === "free";
  const matchedSkills = matchBreakdownLocked
    ? []
    : match.matchedSkillIds.map((id) => ({ id, name: nameById.get(id) ?? "Skill" }));
  const missingSkills = matchBreakdownLocked
    ? []
    : match.missingSkillIds.map((id) => ({ id, name: nameById.get(id) ?? "Skill" }));

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    country: job.country,
    workMode: job.work_mode as WorkMode | null,
    salaryMin: job.salary_min === null ? null : Number(job.salary_min),
    salaryMax: job.salary_max === null ? null : Number(job.salary_max),
    salaryCurrency: job.salary_currency,
    description: job.description,
    experienceYearsMin: job.experience_years_min,
    educationRequirement: job.education_requirement as EducationLevel | null,
    postedAt: job.posted_at,
    retrievedAt: job.retrieved_at,
    isDemo: job.is_demo,
    sourceName: (job.job_sources as { name: string } | null)?.name ?? null,
    sourceUrl: job.source_url,
    isSaved,
    requiredSkills: required,
    preferredSkills: preferred,
    match,
    matchedSkills,
    missingSkills,
    matchBreakdownLocked,
  };
}

export type { JobFilters, JobSortOption, ExperienceBand };
