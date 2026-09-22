import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdzunaJobSourceAdapter,
  AdzunaProviderError,
  createAdzunaAdapterFromEnv,
  isAdzunaConfigured,
} from "@/lib/jobs/adzuna-adapter.server";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function oneResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 123456,
    title: "Data Analyst",
    company: { display_name: "Acme Corp" },
    location: { display_name: "London, UK" },
    description: "Analyze data and build dashboards.",
    redirect_url: "https://www.adzuna.com/details/123456",
    salary_min: 45000,
    salary_max: 60000,
    created: "2026-08-01T12:00:00Z",
    contract_time: "full_time",
    ...overrides,
  };
}

describe("isAdzunaConfigured / createAdzunaAdapterFromEnv", () => {
  const originalId = process.env["ADZUNA_APP_ID"];
  const originalKey = process.env["ADZUNA_APP_KEY"];
  const originalApiKeyAlias = process.env["ADZUNA_API_KEY"];

  afterEach(() => {
    if (originalId === undefined) delete process.env["ADZUNA_APP_ID"];
    else process.env["ADZUNA_APP_ID"] = originalId;
    if (originalKey === undefined) delete process.env["ADZUNA_APP_KEY"];
    else process.env["ADZUNA_APP_KEY"] = originalKey;
    if (originalApiKeyAlias === undefined) delete process.env["ADZUNA_API_KEY"];
    else process.env["ADZUNA_API_KEY"] = originalApiKeyAlias;
  });

  it("is false when credentials are missing", () => {
    delete process.env["ADZUNA_APP_ID"];
    delete process.env["ADZUNA_APP_KEY"];
    delete process.env["ADZUNA_API_KEY"];
    expect(isAdzunaConfigured()).toBe(false);
  });

  it("is false when only one credential is present", () => {
    process.env["ADZUNA_APP_ID"] = "id";
    delete process.env["ADZUNA_APP_KEY"];
    delete process.env["ADZUNA_API_KEY"];
    expect(isAdzunaConfigured()).toBe(false);
  });

  it("is true when both credentials are present and non-empty", () => {
    process.env["ADZUNA_APP_ID"] = "id";
    process.env["ADZUNA_APP_KEY"] = "key";
    delete process.env["ADZUNA_API_KEY"];
    expect(isAdzunaConfigured()).toBe(true);
  });

  it("createAdzunaAdapterFromEnv throws AdzunaProviderError(missing_credentials) when unset", () => {
    delete process.env["ADZUNA_APP_ID"];
    delete process.env["ADZUNA_APP_KEY"];
    delete process.env["ADZUNA_API_KEY"];
    expect(() => createAdzunaAdapterFromEnv()).toThrow(AdzunaProviderError);
    try {
      createAdzunaAdapterFromEnv();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AdzunaProviderError);
      expect((err as AdzunaProviderError).code).toBe("missing_credentials");
      expect((err as AdzunaProviderError).message).not.toContain("key");
    }
  });

  it("createAdzunaAdapterFromEnv succeeds when both are set", () => {
    process.env["ADZUNA_APP_ID"] = "id";
    process.env["ADZUNA_APP_KEY"] = "key";
    delete process.env["ADZUNA_API_KEY"];
    expect(() => createAdzunaAdapterFromEnv()).not.toThrow();
  });

  it("accepts ADZUNA_API_KEY as a fallback alias for ADZUNA_APP_KEY (common naming mismatch)", () => {
    process.env["ADZUNA_APP_ID"] = "id";
    delete process.env["ADZUNA_APP_KEY"];
    process.env["ADZUNA_API_KEY"] = "key-under-alias-name";
    expect(isAdzunaConfigured()).toBe(true);
    expect(() => createAdzunaAdapterFromEnv()).not.toThrow();
  });

  it("prefers ADZUNA_APP_KEY over the ADZUNA_API_KEY alias when both are set", async () => {
    process.env["ADZUNA_APP_ID"] = "id";
    process.env["ADZUNA_APP_KEY"] = "canonical-key";
    process.env["ADZUNA_API_KEY"] = "alias-key";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createAdzunaAdapterFromEnv({ maxJobs: 1 });
    await adapter.fetchJobs();

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("app_key=canonical-key");
    expect(String(url)).not.toContain("alias-key");
    vi.unstubAllGlobals();
  });
});

describe("AdzunaJobSourceAdapter — mapping", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks isDemo false and preserves core adapter identity", () => {
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 });
    expect(adapter.isDemo).toBe(false);
    expect(adapter.sourceSlug).toBe("adzuna");
    expect(adapter.sourceName).toBe("Adzuna");
  });

  it("maps a full result to RawProviderJob with every field preserved", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [oneResult()], count: 1 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5, country: "gb" });
    const jobs = await adapter.fetchJobs();

    expect(jobs).toHaveLength(1);
    const job = jobs[0]!;
    expect(job.externalId).toBe("123456");
    expect(job.title).toBe("Data Analyst");
    expect(job.company).toBe("Acme Corp");
    expect(job.location).toBe("London, UK");
    expect(job.country).toBe("GB");
    expect(job.description).toBe("Analyze data and build dashboards.");
    expect(job.url).toBe("https://www.adzuna.com/details/123456");
    expect(job.salaryMin).toBe(45000);
    expect(job.salaryMax).toBe(60000);
    expect(job.postedAt).toBe("2026-08-01T12:00:00Z");
    expect(job.employmentType).toBe("full_time");
    expect(adapter.invalidRecordCount).toBe(0);
  });

  it("falls back gracefully when optional fields are missing", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ id: 7, title: "Backend Engineer" }],
        count: 1,
      }),
    );
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 });
    const jobs = await adapter.fetchJobs();

    expect(jobs).toHaveLength(1);
    const job = jobs[0]!;
    expect(job.externalId).toBe("7");
    expect(job.company).toBe("Unknown company");
    expect(job.location).toBeNull();
    expect(job.description).toBeNull();
    expect(job.salaryMin).toBeNull();
    expect(job.salaryMax).toBeNull();
    expect(job.postedAt).toBeNull();
  });

  it("coerces a numeric id to a string external id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [oneResult({ id: 999 })], count: 1 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 });
    const jobs = await adapter.fetchJobs();
    expect(jobs[0]!.externalId).toBe("999");
    expect(typeof jobs[0]!.externalId).toBe("string");
  });

  it("skips malformed records but keeps valid ones, tracking invalidRecordCount", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          oneResult({ id: 1 }),
          { title: "Missing id entirely" }, // invalid: no id
          { id: 2 }, // invalid: no title
          oneResult({ id: 3 }),
        ],
        count: 4,
      }),
    );
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 10 });
    const jobs = await adapter.fetchJobs();

    expect(jobs.map((j) => j.externalId)).toEqual(["1", "3"]);
    expect(adapter.invalidRecordCount).toBe(2);
  });

  it("paginates until maxJobs is reached", async () => {
    const page1Results = Array.from({ length: 50 }, (_, i) => oneResult({ id: i + 1 }));
    const page2Results = Array.from({ length: 10 }, (_, i) => oneResult({ id: i + 51 }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: page1Results, count: 60 }))
      .mockResolvedValueOnce(jsonResponse({ results: page2Results, count: 60 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 60 });
    const jobs = await adapter.fetchJobs();

    expect(jobs).toHaveLength(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops paginating when a page returns fewer results than requested (last page)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [oneResult({ id: 1 })], count: 1 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 20 });
    const jobs = await adapter.fetchJobs();
    expect(jobs).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never puts the app key in the request as a header (only as a query param on Adzuna's own URL)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));
    const adapter = new AdzunaJobSourceAdapter("secret-id", "secret-key", { maxJobs: 5 });
    await adapter.fetchJobs();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).not.toHaveProperty("app_key");
    const calledUrl = String(fetchMock.mock.calls[0]![0]);
    expect(calledUrl).toContain("app_id=secret-id");
    expect(calledUrl).toContain("app_key=secret-key");
    expect(calledUrl.startsWith("https://api.adzuna.com/v1/api/jobs/")).toBe(true);
  });
});

describe("AdzunaJobSourceAdapter — provider error handling", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws unauthorized on HTTP 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("throws forbidden on HTTP 403", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "forbidden" });
  });

  it("throws rate_limited on HTTP 429", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("throws server_error on HTTP 500", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "server_error" });
  });

  it("throws invalid_response on malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json{{", { status: 200 }));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("throws invalid_response when the top-level shape is unrecognized", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: true }));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("throws network_error when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "network_error" });
  });

  it("throws timeout when the request is aborted", async () => {
    fetchMock.mockImplementationOnce(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const adapter = new AdzunaJobSourceAdapter("id", "key");
    await expect(adapter.fetchJobs()).rejects.toMatchObject({ code: "timeout" });
  });

  it("never includes the app key in a thrown error message", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const adapter = new AdzunaJobSourceAdapter("very-secret-key-value", "very-secret-key-value");
    try {
      await adapter.fetchJobs();
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain("very-secret-key-value");
    }
  });

  it("one malformed record does not abort the whole batch", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [oneResult({ id: 1 }), { garbage: true }, oneResult({ id: 2 })],
        count: 3,
      }),
    );
    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 10 });
    const jobs = await adapter.fetchJobs();
    expect(jobs).toHaveLength(2);
    expect(adapter.invalidRecordCount).toBe(1);
  });
});
