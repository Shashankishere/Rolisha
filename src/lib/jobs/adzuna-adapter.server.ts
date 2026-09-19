/**
 * Adzuna `JobSourceAdapter` — the first live external job provider.
 *
 * Talks only to Adzuna's official REST API (`/v1/api/jobs/{country}/search/{page}`),
 * never scrapes adzuna.com. Credentials come exclusively from
 * `process.env.ADZUNA_APP_ID` / `process.env.ADZUNA_APP_KEY` (or the
 * `ADZUNA_API_KEY` alias for the latter — see `isAdzunaConfigured()`) —
 * never from a `VITE_`-prefixed variable, so they can never be bundled
 * into client code. This file has a `.server.ts` suffix and must only ever
 * be imported from other `.server.ts` modules or server-function handlers.
 */
import { z } from "zod";
import type { JobSourceAdapter, RawProviderJob } from "@/lib/jobs/types";

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESULTS_PER_PAGE = 50; // Adzuna's documented per-page ceiling.
const HARD_MAX_JOBS = 100; // Safety ceiling regardless of what a caller requests.

/**
 * Raised for anything that stops ingestion for the whole batch (bad
 * credentials, rate limiting, provider outage, network/timeout). Never
 * carries the API key. Individual malformed *records* do not raise this —
 * they're skipped and counted instead (see `fetchJobs()`).
 */
export class AdzunaProviderError extends Error {
  readonly code:
    | "missing_credentials"
    | "unauthorized"
    | "forbidden"
    | "rate_limited"
    | "server_error"
    | "invalid_response"
    | "network_error"
    | "timeout";

  constructor(code: AdzunaProviderError["code"], message: string) {
    super(message);
    this.name = "AdzunaProviderError";
    this.code = code;
  }
}

export interface AdzunaSearchParams {
  /** Free-text search query, e.g. "data analyst". Maps to Adzuna's `what`. */
  query?: string | null | undefined;
  /** Free-text location, e.g. "London". Maps to Adzuna's `where`. */
  location?: string | null | undefined;
  /** Adzuna's 2-letter country code, e.g. "us", "gb", "in". Defaults to "us". */
  country?: string | null | undefined;
  /** Maximum number of jobs to fetch across all pages. Capped at HARD_MAX_JOBS. */
  maxJobs?: number | null | undefined;
}

/** True when both required env vars are present and non-empty. Safe to call from a route/UI status check.
 *
 * Adzuna's own docs call the second credential an "App Key", so the
 * canonical variable name is `ADZUNA_APP_KEY`. In practice this gets
 * mistyped/renamed to the more generic `ADZUNA_API_KEY` fairly often when
 * someone configures it from memory -- both are accepted here (APP_KEY
 * takes precedence if somehow both are set) so a very common naming
 * mismatch doesn't silently leave the integration looking "not configured"
 * even though a real key was provided. `ADZUNA_APP_ID` has no such alias:
 * Adzuna's own docs and every integration guide call it exactly that. */
export function isAdzunaConfigured(): boolean {
  const appId = process.env["ADZUNA_APP_ID"];
  const appKey = process.env["ADZUNA_APP_KEY"] || process.env["ADZUNA_API_KEY"];
  return Boolean(appId && appId.trim().length > 0 && appKey && appKey.trim().length > 0);
}

// --- Zod validation of Adzuna's response shape -----------------------------
// Deliberately permissive with `.passthrough()`/optional fields: Adzuna is a
// third party and can add/omit fields without notice. We only require the
// bare minimum to build a usable RawProviderJob; anything else is discarded.

const adzunaCompanySchema = z.object({ display_name: z.string().trim().optional() }).partial();
const adzunaLocationSchema = z.object({ display_name: z.string().trim().optional() }).partial();

const adzunaResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().trim().min(1),
  company: adzunaCompanySchema.nullable().optional(),
  location: adzunaLocationSchema.nullable().optional(),
  description: z.string().nullable().optional(),
  redirect_url: z.string().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  created: z.string().nullable().optional(),
  contract_time: z.string().nullable().optional(),
});

const adzunaSearchResponseSchema = z.object({
  results: z.array(z.unknown()),
  count: z.number().optional(),
});

type AdzunaResult = z.infer<typeof adzunaResultSchema>;

function mapResultToRawJob(result: AdzunaResult, country: string): RawProviderJob {
  return {
    externalId: String(result.id),
    title: result.title,
    company: result.company?.display_name ?? "Unknown company",
    location: result.location?.display_name ?? null,
    country: country.toUpperCase(),
    description: result.description ?? null,
    url: result.redirect_url ?? null,
    salaryMin: result.salary_min ?? null,
    salaryMax: result.salary_max ?? null,
    salaryCurrency: null, // Adzuna doesn't return a currency code on the free search endpoint.
    employmentType: result.contract_time ?? null,
    experienceYearsMin: null, // Adzuna doesn't supply this directly.
    educationRequirement: null, // Adzuna doesn't supply this directly.
    postedAt: result.created ?? null,
    rawMetadata: null, // No metadata column on `jobs` yet — see NORMALIZATION_GAPS.
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AdzunaProviderError("timeout", "Adzuna request timed out.");
    }
    throw new AdzunaProviderError(
      "network_error",
      `Network error contacting Adzuna: ${err instanceof Error ? err.message : "unknown error"}.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function throwForHttpStatus(status: number): never {
  if (status === 401) {
    throw new AdzunaProviderError(
      "unauthorized",
      "Adzuna rejected the request (HTTP 401 — invalid credentials).",
    );
  }
  if (status === 403) {
    throw new AdzunaProviderError(
      "forbidden",
      "Adzuna rejected the request (HTTP 403 — forbidden).",
    );
  }
  if (status === 429) {
    throw new AdzunaProviderError(
      "rate_limited",
      "Adzuna rate limit exceeded (HTTP 429). Try again later.",
    );
  }
  if (status >= 500) {
    throw new AdzunaProviderError("server_error", `Adzuna server error (HTTP ${status}).`);
  }
  throw new AdzunaProviderError(
    "invalid_response",
    `Adzuna returned an unexpected status (HTTP ${status}).`,
  );
}

export class AdzunaJobSourceAdapter implements JobSourceAdapter {
  readonly sourceSlug = "adzuna";
  readonly sourceName = "Adzuna";
  readonly baseUrl: string = ADZUNA_BASE_URL;
  readonly isDemo = false;

  /** Records that arrived from Adzuna but failed shape validation — skipped, not fatal. Set after fetchJobs() resolves. */
  invalidRecordCount = 0;

  private readonly appId: string;
  private readonly appKey: string;
  private readonly query: string | null;
  private readonly location: string | null;
  private readonly country: string;
  private readonly maxJobs: number;

  constructor(appId: string, appKey: string, params: AdzunaSearchParams = {}) {
    if (!appId || !appKey) {
      throw new AdzunaProviderError(
        "missing_credentials",
        "Adzuna credentials are not configured.",
      );
    }
    this.appId = appId;
    this.appKey = appKey;
    this.query = params.query?.trim() ? params.query.trim() : null;
    this.location = params.location?.trim() ? params.location.trim() : null;
    // Default to India: Rolisha is an India-first product. Callers that
    // need another market still pass params.country explicitly.
    this.country = (params.country?.trim() || "in").toLowerCase();
    const requested = params.maxJobs ?? 20;
    this.maxJobs = Math.min(Math.max(1, requested), HARD_MAX_JOBS);
  }

  private buildUrl(page: number, resultsPerPage: number): string {
    const url = new URL(`${ADZUNA_BASE_URL}/${this.country}/search/${page}`);
    url.searchParams.set("app_id", this.appId);
    url.searchParams.set("app_key", this.appKey);
    url.searchParams.set("results_per_page", String(resultsPerPage));
    url.searchParams.set("content-type", "application/json");
    if (this.query) url.searchParams.set("what", this.query);
    if (this.location) url.searchParams.set("where", this.location);
    return url.toString();
  }

  /** Never logs or throws with the URL/credentials embedded — safe to surface `message` to an admin UI. */
  async fetchJobs(): Promise<RawProviderJob[]> {
    this.invalidRecordCount = 0;
    const jobs: RawProviderJob[] = [];
    let page = 1;

    while (jobs.length < this.maxJobs) {
      const remaining = this.maxJobs - jobs.length;
      const resultsPerPage = Math.min(MAX_RESULTS_PER_PAGE, remaining);
      const response = await fetchWithTimeout(this.buildUrl(page, resultsPerPage));

      if (!response.ok) throwForHttpStatus(response.status);

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new AdzunaProviderError(
          "invalid_response",
          "Adzuna returned a response that was not valid JSON.",
        );
      }

      const parsed = adzunaSearchResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new AdzunaProviderError(
          "invalid_response",
          "Adzuna returned a response shape this adapter doesn't recognize.",
        );
      }

      const rawResults = parsed.data.results;
      if (rawResults.length === 0) break; // No more pages.

      for (const rawResult of rawResults) {
        if (jobs.length >= this.maxJobs) break;
        const resultParsed = adzunaResultSchema.safeParse(rawResult);
        if (!resultParsed.success) {
          this.invalidRecordCount += 1;
          continue;
        }
        jobs.push(mapResultToRawJob(resultParsed.data, this.country));
      }

      if (rawResults.length < resultsPerPage) break; // Last page.
      page += 1;
    }

    return jobs;
  }
}

/**
 * Builds an adapter from server-only env vars. Throws `AdzunaProviderError`
 * (code: "missing_credentials") rather than returning a half-configured
 * adapter — callers should check `isAdzunaConfigured()` first if they want
 * to show a status message instead of catching an error.
 *
 * Accepts `ADZUNA_API_KEY` as a fallback alias for `ADZUNA_APP_KEY` — see
 * the comment on `isAdzunaConfigured()`.
 */
export function createAdzunaAdapterFromEnv(
  params: AdzunaSearchParams = {},
): AdzunaJobSourceAdapter {
  const appId = process.env["ADZUNA_APP_ID"];
  const appKey = process.env["ADZUNA_APP_KEY"] || process.env["ADZUNA_API_KEY"];
  if (!appId || !appKey) {
    throw new AdzunaProviderError(
      "missing_credentials",
      "Adzuna is not configured: set ADZUNA_APP_ID and ADZUNA_APP_KEY.",
    );
  }
  return new AdzunaJobSourceAdapter(appId, appKey, params);
}
