/**
 * Server-side job ingestion pipeline.
 *
 * Orchestrates (does not reimplement) the pieces that already exist:
 *   adapter.fetchJobs() -> normalizeJob() -> upsert `jobs` -> extractSkills() -> upsert `job_skills`
 *
 * This module must only ever be called with a service-role ("admin") Supabase
 * client, because writes to `jobs`/`job_sources`/`job_skills` are
 * admin-gated by RLS. Callers (server functions) are responsible for
 * confirming the requesting user is an admin BEFORE invoking this.
 */
import { classifyCareer, type CareerCatalogEntry } from "@/lib/jobs/career-classification";
import { dedupeKey, normalizeJob } from "@/lib/jobs/normalize";
import { extractSkills, type SkillCatalogEntry } from "@/lib/jobs/skill-extraction";
import type {
  IngestionSummary,
  JobSourceAdapter,
  NormalizedJob,
  RawProviderJob,
} from "@/lib/jobs/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AdminClient = any;

/** Best-effort external id for error reporting when a record is too malformed to normalize. */
function safeExternalId(raw: unknown): string | null {
  const id = (raw as { externalId?: unknown } | null | undefined)?.externalId;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

async function ensureJobSource(
  supabaseAdmin: AdminClient,
  adapter: JobSourceAdapter,
): Promise<{ id: string }> {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("job_sources")
    .select("id")
    .eq("slug", adapter.sourceSlug)
    .maybeSingle();
  if (findError) throw new Error(`Unable to look up job source "${adapter.sourceSlug}".`);
  if (existing) return existing as { id: string };

  const { data: created, error: insertError } = await supabaseAdmin
    .from("job_sources")
    .insert({
      slug: adapter.sourceSlug,
      name: adapter.sourceName,
      adapter: adapter.sourceSlug,
      base_url: adapter.baseUrl ?? null,
      is_enabled: true,
      is_demo: adapter.isDemo,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    throw new Error(`Unable to create job source "${adapter.sourceSlug}".`);
  }
  return created as { id: string };
}

async function loadSkillsCatalog(supabaseAdmin: AdminClient): Promise<SkillCatalogEntry[]> {
  const { data, error } = await supabaseAdmin.from("skills").select("id, name, aliases");
  if (error) throw new Error("Unable to load the skills catalog for extraction.");
  return (data ?? []) as SkillCatalogEntry[];
}

/**
 * Bulk-loads the careers catalogue plus every `career_skills` link in two
 * queries total (not N+1 — see career-classification.ts's contract), so
 * `classifyCareer()` can run once per job without hitting the database
 * again for each posting.
 */
async function loadCareerCatalog(supabaseAdmin: AdminClient): Promise<CareerCatalogEntry[]> {
  const { data: careers, error: careersError } = await supabaseAdmin
    .from("careers")
    .select("id, slug, title, short_description, description");
  if (careersError) throw new Error("Unable to load the careers catalog for classification.");

  const { data: careerSkills, error: careerSkillsError } = await supabaseAdmin
    .from("career_skills")
    .select("career_id, skill_id");
  if (careerSkillsError) throw new Error("Unable to load career_skills for classification.");

  const skillsByCareer = new Map<string, string[]>();
  for (const row of (careerSkills ?? []) as { career_id: string; skill_id: string }[]) {
    const list = skillsByCareer.get(row.career_id) ?? [];
    list.push(row.skill_id);
    skillsByCareer.set(row.career_id, list);
  }

  return (
    (careers ?? []) as {
      id: string;
      slug: string;
      title: string;
      short_description: string | null;
      description: string | null;
    }[]
  ).map((career) => ({
    id: career.id,
    slug: career.slug,
    title: career.title,
    shortDescription: career.short_description,
    description: career.description,
    skillIds: skillsByCareer.get(career.id) ?? [],
  }));
}

function toJobRow(sourceId: string, isDemo: boolean, job: NormalizedJob) {
  return {
    source_id: sourceId,
    external_id: job.externalId,
    title: job.title,
    company: job.company,
    location: job.location,
    country: job.country,
    work_mode: job.workMode,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    salary_currency: job.salaryCurrency,
    description: job.description,
    experience_years_min: job.experienceYearsMin,
    education_requirement: job.educationRequirement,
    career_id: job.careerId,
    source_url: job.sourceUrl,
    posted_at: job.postedAt,
    is_demo: isDemo,
    // Stamped on every insert/update so stale-job detection (see
    // adzuna-sync-task.server.ts) can tell "still showing up in live
    // results" apart from "hasn't been seen in a while" -- without this,
    // a real posting that's simply no longer returned by the provider
    // would never get flagged, and the jobs table would only ever grow.
    last_seen_at: new Date().toISOString(),
    is_active: true,
  };
}

/**
 * Ingests jobs from a single adapter. Safe to re-run: postings are upserted
 * by (source_id, external_id) so re-ingesting the same feed updates existing
 * rows instead of duplicating them.
 */
export async function ingestJobs(
  supabaseAdmin: AdminClient,
  adapter: JobSourceAdapter,
): Promise<IngestionSummary> {
  const summary: IngestionSummary = {
    sourceSlug: adapter.sourceSlug,
    jobsReceived: 0,
    jobsInserted: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    skillsExtracted: 0,
    careersClassified: 0,
    errors: [],
  };

  const rawJobs: RawProviderJob[] = await adapter.fetchJobs();
  summary.jobsReceived = rawJobs.length;
  if (rawJobs.length === 0) return summary;

  const source = await ensureJobSource(supabaseAdmin, adapter);
  const [skillsCatalog, careerCatalog] = await Promise.all([
    loadSkillsCatalog(supabaseAdmin),
    loadCareerCatalog(supabaseAdmin),
  ]);

  // In-memory de-duplication for postings without an external id (the DB's
  // unique index only covers rows where external_id IS NOT NULL).
  const seen = new Set<string>();

  for (const raw of rawJobs) {
    // Normalization is guarded per record, NOT done up-front in a bulk
    // `.map()`: one malformed record (a non-string title from a provider
    // that isn't as strict as the Adzuna adapter, a null entry, ...) must be
    // counted and skipped, never abort every other posting in the batch.
    let job: NormalizedJob;
    try {
      job = normalizeJob(raw);
    } catch {
      summary.jobsSkipped += 1;
      summary.errors.push({
        externalId: safeExternalId(raw),
        message: "Malformed provider record could not be normalized.",
      });
      continue;
    }

    const key = dedupeKey(job);
    if (seen.has(key)) {
      summary.jobsSkipped += 1;
      continue;
    }
    seen.add(key);

    try {
      // Find any existing row for this posting so we never let demo data
      // clobber a real (is_demo = false) posting, and so we can report
      // insert vs update accurately.
      let existing: { id: string; is_demo: boolean } | null = null;
      if (job.externalId) {
        const { data, error: lookupError } = await supabaseAdmin
          .from("jobs")
          .select("id, is_demo")
          .eq("source_id", source.id)
          .eq("external_id", job.externalId)
          .maybeSingle();
        // A failed lookup must NOT be read as "no existing row": that would
        // turn an update into a doomed insert and report a misleading error.
        if (lookupError)
          throw new Error(`Lookup failed: ${lookupError.message ?? "unknown error"}`);
        existing = data ?? null;
      }

      if (existing && existing.is_demo === false && adapter.isDemo === true) {
        // Never overwrite real data with demo data.
        summary.jobsSkipped += 1;
        continue;
      }

      // Skills are extracted before classification (not after insert, as
      // before) because career classification uses the extracted skill IDs
      // as one of its signals. The same `extracted` list is reused below for
      // the `job_skills` upsert, so this text scan only ever runs once.
      const extracted = extractSkills(job.title, job.description, skillsCatalog);
      const classification = classifyCareer(
        {
          title: job.title,
          description: job.description,
          extractedSkillIds: extracted.map((s) => s.skillId),
        },
        careerCatalog,
      );
      job.careerId = classification.careerId;
      if (classification.careerId) summary.careersClassified += 1;

      const row = toJobRow(source.id, adapter.isDemo, job);
      let jobId: string;

      if (existing) {
        const { data: updated, error } = await supabaseAdmin
          .from("jobs")
          .update(row)
          .eq("id", existing.id)
          .select("id")
          .single();
        if (error || !updated) throw new Error(error?.message ?? "Update failed.");
        jobId = updated.id;
        summary.jobsUpdated += 1;
      } else {
        const { data: inserted, error } = await supabaseAdmin
          .from("jobs")
          .insert(row)
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Insert failed.");
        jobId = inserted.id;
        summary.jobsInserted += 1;
      }

      if (extracted.length > 0) {
        const { error: skillsError } = await supabaseAdmin.from("job_skills").upsert(
          extracted.map((s) => ({
            job_id: jobId,
            skill_id: s.skillId,
            is_required: true,
            raw_text: s.matchedText,
          })),
          { onConflict: "job_id,skill_id" },
        );
        if (skillsError) throw new Error(skillsError.message);
        summary.skillsExtracted += extracted.length;
      }
    } catch (err) {
      summary.jobsSkipped += 1;
      summary.errors.push({
        externalId: job.externalId,
        message: err instanceof Error ? err.message : "Unknown ingestion error.",
      });
    }
  }

  await supabaseAdmin
    .from("job_sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", source.id);

  return summary;
}

export interface DemoCleanupResult {
  removed: number;
  skipped: false;
  reason?: undefined;
}

export interface DemoCleanupSkipped {
  removed: 0;
  skipped: true;
  reason: string;
}

/**
 * Removes the seeded `is_demo = true` job rows once real Adzuna data is
 * confirmed present (Part 8 of the dynamic-search requirements: production
 * shouldn't depend on demo jobs, but blindly deleting them via a migration
 * that runs on every deploy would be unsafe if live ingestion hasn't
 * actually produced anything yet). Only ever called from the admin-gated
 * "Remove demo jobs" action on /admin/jobs -- never automatic.
 *
 * Refuses to run if there isn't at least one real, active job already in
 * the table, so an admin can't accidentally empty the Jobs Explorer down to
 * nothing by clicking this before ingestion has actually produced live
 * data.
 */
export async function removeDemoJobs(
  supabaseAdmin: AdminClient,
): Promise<DemoCleanupResult | DemoCleanupSkipped> {
  const { count: liveCount } = await supabaseAdmin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("is_demo", false)
    .eq("is_active", true);

  if (!liveCount || liveCount === 0) {
    return {
      removed: 0,
      skipped: true,
      reason: "No live (non seeded, active) jobs exist yet. Run a sync first, then try again.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .delete()
    .eq("is_demo", true)
    .select("id");
  if (error) throw new Error("Unable to remove seeded jobs.");
  return { removed: (data ?? []).length, skipped: false };
}
