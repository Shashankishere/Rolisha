/**
 * Regression tests for the production error:
 *
 *   AI response didn't match the expected shape:
 *   [{ code: "invalid_type", expected: "array", received: "string",
 *      path: ["recommendations"] }]
 *
 * Root cause: the prompt never told the model `recommendations` must be an
 * array (unlike strengths/weaknesses), and `json_object` mode only guarantees
 * valid JSON, so the model returned prose. The strict `z.array(z.string())`
 * then rejected the whole (paid-for) generation, and the raw Zod dump was
 * stored and shown to the customer.
 *
 * Like resume-analysis.schema.server.test.ts these run the REAL
 * analyzeResume -> generateStructured -> JSON.parse -> Zod pipeline; only the
 * network (`fetch`) is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import {
  analysisSchema,
  analyzeResume,
  listResumeAnalyses,
} from "@/lib/premium/resume-analysis.server";

const ORIGINAL_ENV = { ...process.env };
const RESUME_MARKER = "PRIVATE-RESUME-CONTENT-7f3a";
const RESUME_TEXT = `${RESUME_MARKER} ${"x".repeat(60)}`;

const VALID_FIELDS = {
  overallScore: 70,
  atsScore: 65,
  atsNotes: "Mostly parseable.",
  skillsDetected: ["SQL"],
  missingSkills: ["Power BI"],
  strengths: ["Strong SQL"],
  weaknesses: ["Limited Power BI experience"],
  experienceRelevance: "Relevant.",
  educationRelevance: "Relevant.",
  keywordCoverage: [{ keyword: "SQL", covered: true }],
  jobDescriptionAlignment: "Good fit.",
};

const FRIENDLY_INCOMPLETE =
  "We couldn't put together a complete response this time. Please try again.";

let fetchMock: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function groqResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Runs analyzeResume with the model returning `output` verbatim as its JSON body. */
async function analyzeWith(output: unknown) {
  fetchMock.mockResolvedValueOnce(
    groqResponse(typeof output === "string" ? output : JSON.stringify(output)),
  );
  const fake = createFakeSupabase();
  seedProfile(fake, USER_A, { plan: "pro" });
  const result = await analyzeResume(fake, USER_A, {
    targetRole: "Data Analyst",
    resumeText: RESUME_TEXT,
  });
  return { fake, result };
}

beforeEach(() => {
  process.env["GROQ_API_KEY"] = "gsk-test-key-value";
  delete process.env["AI_PROVIDER"];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
});

describe("resume analysis recommendations -- valid array (normal case)", () => {
  it("accepts and preserves an array of recommendations exactly", async () => {
    const recs = ["Quantify the impact of your SQL project", "Add a Power BI dashboard"];
    const { result, fake } = await analyzeWith({ ...VALID_FIELDS, recommendations: recs });

    expect(result.status).toBe("completed");
    expect(result.recommendations).toEqual(recs);
    expect(fake.table("resume_analyses")[0]!["recommendations"]).toEqual(recs);
  });
});

describe("resume analysis recommendations -- the exact production failure", () => {
  it("recommendations returned as a plain string no longer fails: it becomes a one-item array, text intact", async () => {
    const text = "Add measurable outcomes to each project and tailor your summary to data roles.";
    const { result, fake } = await analyzeWith({ ...VALID_FIELDS, recommendations: text });

    expect(result.status).toBe("completed");
    expect(result.errorMessage).toBeNull();
    expect(result.recommendations).toEqual([text]); // nothing dropped, nothing invented
    // The row that reaches the UI / database satisfies the schema (an array).
    expect(Array.isArray(fake.table("resume_analyses")[0]!["recommendations"])).toBe(true);
  });

  it("a numbered list delivered as one string is split into one recommendation per item", async () => {
    const { result } = await analyzeWith({
      ...VALID_FIELDS,
      recommendations:
        "1. Quantify the impact of your SQL project\n2. Add a Power BI dashboard\n3) Tailor the summary\n   to the target role",
    });

    expect(result.status).toBe("completed");
    expect(result.recommendations).toEqual([
      "Quantify the impact of your SQL project",
      "Add a Power BI dashboard",
      "Tailor the summary to the target role", // wrapped continuation line re-joined
    ]);
  });

  it("a bulleted list delivered as one string is split per bullet", async () => {
    const { result } = await analyzeWith({
      ...VALID_FIELDS,
      recommendations: "- Add metrics\n- Add a portfolio link\n* Trim the objective",
    });
    expect(result.recommendations).toEqual([
      "Add metrics",
      "Add a portfolio link",
      "Trim the objective",
    ]);
  });

  it("a JSON array serialized inside a string is parsed back into an array", async () => {
    const { result } = await analyzeWith({
      ...VALID_FIELDS,
      recommendations: '["Add metrics", "Add a portfolio link"]',
    });
    expect(result.status).toBe("completed");
    expect(result.recommendations).toEqual(["Add metrics", "Add a portfolio link"]);
  });

  it("an array of {title, description} objects is flattened to strings without losing text", async () => {
    const { result } = await analyzeWith({
      ...VALID_FIELDS,
      recommendations: [
        { title: "Add metrics", description: "Show percentage improvements." },
        { text: "Link your GitHub" },
      ],
    });
    expect(result.status).toBe("completed");
    expect(result.recommendations).toEqual([
      "Add metrics: Show percentage improvements.",
      "Link your GitHub",
    ]);
  });
});

describe("resume analysis -- validation stays strict for genuinely malformed output", () => {
  it.each([
    ["a number", 42],
    ["an unrecognised object", { anything: 1 }],
    ["an array of numbers", [1, 2, 3]],
    ["a missing field", undefined],
  ])(
    "recommendations as %s is still a failed run with no fabricated content",
    async (_label, value) => {
      const body: Record<string, unknown> = { ...VALID_FIELDS };
      if (value !== undefined) body["recommendations"] = value;

      const { result } = await analyzeWith(body);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe(FRIENDLY_INCOMPLETE);
      expect(result.recommendations).toEqual([]);
      expect(result.strengths).toEqual([]);
    },
  );

  it("more than 15 recommendations still fails the max constraint (never silently truncated)", async () => {
    const tooMany = Array.from({ length: 16 }, (_, i) => `Recommendation ${i}`);
    const { result } = await analyzeWith({ ...VALID_FIELDS, recommendations: tooMany });
    expect(result.status).toBe("failed");
  });

  it("a response that is not JSON at all is a failed run with product copy", async () => {
    const { result } = await analyzeWith("Sorry, here is some prose instead of JSON.");
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe(FRIENDLY_INCOMPLETE);
  });

  it("other list fields keep their existing strictness (missingSkills as a string still fails)", async () => {
    const { result } = await analyzeWith({
      ...VALID_FIELDS,
      recommendations: ["ok"],
      missingSkills: "Power BI",
    });
    expect(result.status).toBe("failed");
  });
});

describe("resume analysis -- prompt contract", () => {
  it("tells the model recommendations must be a JSON array of strings, not one string", async () => {
    await analyzeWith({ ...VALID_FIELDS, recommendations: ["ok"] });
    const sent = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body)) as {
      messages: { content: string }[];
    };
    const prompt = sent.messages.map((m) => m.content).join("\n");
    expect(prompt).toMatch(/recommendations \(a JSON array of short, actionable strings/);
    expect(prompt).toMatch(/never a single string or one combined paragraph/);
  });
});

describe("resume analysis -- errors are human-readable for users, detailed in logs", () => {
  it("never persists or returns raw Zod/provider text", async () => {
    const { result, fake } = await analyzeWith({ ...VALID_FIELDS, recommendations: 42 });
    const stored = String(fake.table("resume_analyses")[0]!["error_message"]);

    for (const text of [result.errorMessage ?? "", stored]) {
      expect(text).toBe(FRIENDLY_INCOMPLETE);
      expect(text).not.toMatch(/invalid_type|expected shape|Expected array|recommendations|\[|\{/);
    }
  });

  it("logs the technical detail server-side without the resume text or the API key", async () => {
    await analyzeWith({ ...VALID_FIELDS, recommendations: 42 });

    const logged = errorSpy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
    expect(logged).toContain("[ai-workflow] table=resume_analyses failed");
    expect(logged).toMatch(/expected shape/); // the detail IS available to developers
    expect(logged).toContain("recommendations");
    expect(logged).not.toContain(RESUME_MARKER);
    expect(logged).not.toContain("gsk-test-key-value");
  });

  it("a provider outage is shown as a service-availability message, not a status code or body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream exploded: secret-detail", { status: 503 }),
    );
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await analyzeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: RESUME_TEXT,
    });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe(
      "The AI service is temporarily unavailable. Please try again in a few minutes.",
    );
    expect(result.errorMessage).not.toMatch(/503|secret-detail/);
  });

  it("rows already stored with the raw production error are shown as product copy when listed", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    fake.seed("resume_analyses", [
      {
        id: "legacy-1",
        user_id: USER_A,
        target_role: "Data Analyst",
        status: "failed",
        error_message:
          'AI response didn\'t match the expected shape: [\n  {\n    "code": "invalid_type",\n    "expected": "array",\n    "received": "string",\n    "path": ["recommendations"]\n  }\n]',
        created_at: new Date().toISOString(),
      },
    ]);

    const rows = await listResumeAnalyses(fake, USER_A);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.errorMessage).toBe(FRIENDLY_INCOMPLETE);
  });
});

describe("analysisSchema (exported for direct contract checks)", () => {
  it("yields a string[] for recommendations whether the model sent a string or an array", () => {
    const fromString = analysisSchema.parse({ ...VALID_FIELDS, recommendations: "Add metrics" });
    const fromArray = analysisSchema.parse({ ...VALID_FIELDS, recommendations: ["Add metrics"] });
    expect(fromString.recommendations).toEqual(["Add metrics"]);
    expect(fromArray.recommendations).toEqual(["Add metrics"]);
  });
});
