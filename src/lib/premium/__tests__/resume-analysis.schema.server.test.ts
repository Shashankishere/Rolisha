/**
 * End-to-end structured-output regression test for the resume-analysis
 * schema fix: `strengths` / `weaknesses` must be validated as JSON arrays
 * of strings, never accepted as a single joined string.
 *
 * Unlike resume-analysis.server.test.ts, this file does NOT mock
 * `@/lib/ai/provider.server` — it exercises the real
 * generateStructured -> callGroq -> JSON.parse -> Zod safeParse pipeline
 * against the actual `analyzeResume` schema, with only the network
 * boundary (`fetch`) mocked. This is what proves the fix works against the
 * real schema rather than a duplicated test-only one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import { analyzeResume } from "@/lib/premium/resume-analysis.server";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

const VALID_FIELDS = {
  overallScore: 70,
  atsScore: 65,
  atsNotes: "Mostly parseable.",
  skillsDetected: ["SQL"],
  missingSkills: ["Power BI"],
  experienceRelevance: "Relevant.",
  educationRelevance: "Relevant.",
  keywordCoverage: [{ keyword: "SQL", covered: true }],
  jobDescriptionAlignment: "Good fit.",
  recommendations: ["Add metrics"],
};

function groqResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resume analysis structured output (strengths/weaknesses arrays)", () => {
  it("accepts strengths/weaknesses as JSON arrays of strings", async () => {
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    delete process.env["AI_PROVIDER"];

    const modelOutput = JSON.stringify({
      ...VALID_FIELDS,
      strengths: ["Strong SQL"],
      weaknesses: ["Limited Power BI experience"],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqResponse(modelOutput)));

    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await analyzeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: "x".repeat(60),
    });

    expect(result.status).toBe("completed");
    expect(result.strengths).toEqual(["Strong SQL"]);
    expect(result.weaknesses).toEqual(["Limited Power BI experience"]);
  });

  it("rejects strengths/weaknesses returned as a single string, and does NOT weaken the schema to accept it", async () => {
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    delete process.env["AI_PROVIDER"];

    const malformedOutput = JSON.stringify({
      ...VALID_FIELDS,
      strengths: "Strong SQL",
      weaknesses: "Limited Power BI experience",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqResponse(malformedOutput)));

    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await analyzeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: "x".repeat(60),
    });

    // The AI call "succeeded" at the network level but failed schema
    // validation, so this must be an honest failed row — never a
    // fabricated/partially-trusted result.
    expect(result.status).toBe("failed");
    // The customer sees product copy, never the raw Zod issue list (which used
    // to name the field and the "expected array" detail). That detail is
    // logged server-side instead.
    expect(result.errorMessage).toBe(
      "We couldn't put together a complete response this time. Please try again.",
    );
    expect(result.errorMessage).not.toMatch(/strengths|array|invalid_type|expected shape/i);
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
  });
});
