/**
 * The only concrete `JobSourceAdapter` shipped with this foundation.
 *
 * Rolisha has no live external job-provider API connected yet (see
 * README/notes for Job Intelligence Step 2). Rather than fabricate one or
 * scrape a site without checking its terms, this adapter lets a trusted
 * admin submit real job postings they've already sourced (e.g. copy-pasted
 * from a company careers page they have permission to reuse), so the rest of
 * the pipeline — normalization, skill extraction, upsert, matching — can be
 * exercised end-to-end with real data today.
 *
 * Adding a true API-based provider later is just a new class implementing
 * `JobSourceAdapter`; nothing else in the pipeline needs to change.
 */
import type { JobSourceAdapter, RawProviderJob } from "@/lib/jobs/types";

export class ManualJobSourceAdapter implements JobSourceAdapter {
  readonly sourceSlug: string;
  readonly sourceName: string;
  readonly baseUrl: string | null;
  readonly isDemo = false;
  private readonly jobs: RawProviderJob[];

  constructor(options: {
    sourceSlug: string;
    sourceName: string;
    baseUrl?: string | null;
    jobs: RawProviderJob[];
  }) {
    this.sourceSlug = options.sourceSlug;
    this.sourceName = options.sourceName;
    this.baseUrl = options.baseUrl ?? null;
    this.jobs = options.jobs;
  }

  async fetchJobs(): Promise<RawProviderJob[]> {
    return this.jobs;
  }
}
