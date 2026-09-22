/**
 * Structured-output regression coverage for every remaining Premium AI
 * feature (resume analysis has its own file:
 * resume-analysis.schema.server.test.ts).
 *
 * Like that file, none of these mock `@/lib/ai/provider.server` — each
 * exercises the real generateStructured -> callGroq -> JSON.parse ->
 * Zod safeParse pipeline against the feature's actual production schema,
 * with only the network boundary (`fetch`) mocked. This is what proves a
 * prompt fix actually improves schema compliance rather than a
 * hand-rolled test-only schema that could drift from production.
 *
 * Each feature gets two cases:
 *  - a correctly-typed model response, which must produce a completed row
 *  - a response with an array field flattened to a string (the failure
 *    mode actually observed from openai/gpt-oss-120b), which must still
 *    produce an honest failed row -- proving the Zod schema was NOT
 *    weakened to accept it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import { generateCareerRecommendations } from "@/lib/premium/career-recommendations.server";
import { analyzeCareerSwitch } from "@/lib/premium/career-switch.server";
import { generateInterviewPrep } from "@/lib/premium/interview-prep.server";
import { generateInterviewQuestions } from "@/lib/premium/interview-questions.server";
import { optimizeResume } from "@/lib/premium/resume-optimization.server";
import {
  finishMockInterview,
  startMockInterview,
  submitMockInterviewAnswer,
} from "@/lib/premium/mock-interview.server";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function useGroq() {
  process.env["GROQ_API_KEY"] = "gsk-test-key";
  delete process.env["AI_PROVIDER"];
}

function mockGroqContent(content: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("career recommendations structured output", () => {
  const validRole = {
    role: "Data Analyst",
    fitReason: "Strong SQL background.",
    missingSkills: ["Power BI"],
    nextSteps: ["Build a dashboard project"],
    roadmapDirection: "Focus on BI tools next.",
    suitableProjects: ["Sales dashboard"],
    jobSearchDirection: "Look for analyst roles at mid-size companies.",
  };

  it("accepts recommendedRoles with array fields as real arrays", async () => {
    useGroq();
    mockGroqContent(JSON.stringify({ recommendedRoles: [validRole] }));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await generateCareerRecommendations(fake, USER_A);
    expect(result.status).toBe("completed");
    expect(result.recommendedRoles[0]?.missingSkills).toEqual(["Power BI"]);
  });

  it("rejects missingSkills returned as a single string", async () => {
    useGroq();
    mockGroqContent(
      JSON.stringify({
        recommendedRoles: [{ ...validRole, missingSkills: "Power BI" }],
      }),
    );
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await generateCareerRecommendations(fake, USER_A);
    expect(result.status).toBe("failed");
    expect(result.recommendedRoles).toEqual([]);
  });
});

describe("career switch analysis structured output", () => {
  const validFields = {
    summary: "Feasible with focused upskilling.",
    transferableSkills: [{ skill: "SQL", howItTransfers: "Used in analytics tooling." }],
    missingSkills: ["Python"],
    experienceGaps: ["No prior analytics role"],
    projectGaps: ["No public dashboard project"],
    learningRequirements: ["Learn Power BI"],
    estimatedRoadmap: [{ phase: "Phase 1", focus: "Learn SQL deeply" }],
    recommendedProjects: ["Build a sales dashboard"],
    jobReadinessGaps: ["No portfolio yet"],
  };

  it("accepts array fields as real arrays", async () => {
    useGroq();
    mockGroqContent(JSON.stringify(validFields));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await analyzeCareerSwitch(fake, USER_A, {
      currentRole: "Support Engineer",
      targetRole: "Data Analyst",
    });
    expect(result.status).toBe("completed");
    expect(result.missingSkills).toEqual(["Python"]);
  });

  it("rejects missingSkills returned as a single string", async () => {
    useGroq();
    mockGroqContent(JSON.stringify({ ...validFields, missingSkills: "Python" }));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await analyzeCareerSwitch(fake, USER_A, {
      currentRole: "Support Engineer",
      targetRole: "Data Analyst",
    });
    expect(result.status).toBe("failed");
    expect(result.missingSkills).toEqual([]);
  });
});

describe("interview prep structured output", () => {
  const validFields = {
    technicalTopics: [{ topic: "SQL joins", why: "Core to the role" }],
    behavioralTopics: [{ topic: "Ownership", why: "Common theme" }],
    roleSpecificAreas: ["Reporting cadence"],
    checklist: ["Review past dashboards"],
    studyRecommendations: ["Practice window functions"],
  };

  it("accepts array fields as real arrays", async () => {
    useGroq();
    mockGroqContent(JSON.stringify(validFields));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await generateInterviewPrep(fake, USER_A, { targetRole: "Data Analyst" });
    expect(result.status).toBe("completed");
    expect(result.roleSpecificAreas).toEqual(["Reporting cadence"]);
  });

  it("rejects roleSpecificAreas returned as a single string", async () => {
    useGroq();
    mockGroqContent(JSON.stringify({ ...validFields, roleSpecificAreas: "Reporting cadence" }));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await generateInterviewPrep(fake, USER_A, { targetRole: "Data Analyst" });
    expect(result.status).toBe("failed");
    expect(result.roleSpecificAreas).toEqual([]);
  });
});

describe("interview questions structured output", () => {
  it("accepts questions as a real array", async () => {
    useGroq();
    mockGroqContent(
      JSON.stringify({ questions: [{ category: "technical", question: "Explain joins." }] }),
    );
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await generateInterviewQuestions(fake, USER_A, { targetRole: "Data Analyst" });
    expect(result.status).toBe("completed");
    expect(result.questions).toHaveLength(1);
  });

  it("rejects questions returned as an object instead of an array", async () => {
    useGroq();
    mockGroqContent(
      JSON.stringify({ questions: { category: "technical", question: "Explain joins." } }),
    );
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await generateInterviewQuestions(fake, USER_A, { targetRole: "Data Analyst" });
    expect(result.status).toBe("failed");
    expect(result.questions).toEqual([]);
  });
});

describe("resume optimization structured output", () => {
  const validFields = {
    summary: "Strengthen quantification throughout.",
    sections: [
      {
        sectionName: "Summary",
        currentText: "Experienced analyst.",
        recommendedText: "Data analyst with 3 years of SQL-driven reporting experience.",
        rationale: "Adds specificity.",
      },
    ],
    keywordImprovements: ["SQL", "Power BI"],
  };

  it("accepts keywordImprovements as a real array", async () => {
    useGroq();
    mockGroqContent(JSON.stringify(validFields));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await optimizeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: "x".repeat(60),
    });
    expect(result.status).toBe("completed");
    expect(result.keywordImprovements).toEqual(["SQL", "Power BI"]);
  });

  it("rejects keywordImprovements returned as a comma-separated string", async () => {
    useGroq();
    mockGroqContent(JSON.stringify({ ...validFields, keywordImprovements: "SQL, Power BI" }));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const result = await optimizeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: "x".repeat(60),
    });
    expect(result.status).toBe("failed");
    expect(result.keywordImprovements).toEqual([]);
  });
});

describe("mock interview structured output", () => {
  it("accepts a valid question set, turn feedback, and overall feedback", async () => {
    useGroq();
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    mockGroqContent(
      JSON.stringify({ questions: [{ category: "technical", question: "Explain indexing." }] }),
    );
    const session = await startMockInterview(fake, USER_A, {
      targetRole: "Backend Engineer",
      questionCount: 3,
    });
    expect(session.status).toBe("in_progress");

    mockGroqContent(
      JSON.stringify({
        quality: 80,
        relevance: 75,
        completeness: 70,
        communication: 85,
        technicalDepth: 60,
        areasToImprove: ["Be more specific"],
        followUpTopics: ["B-tree indexes"],
      }),
    );
    const turn = await submitMockInterviewAnswer(fake, USER_A, {
      sessionId: session.id,
      turnIndex: 0,
      answer: "An index speeds up lookups.",
    });
    expect(turn.feedback?.status).toBe("completed");
    expect(turn.feedback?.areasToImprove).toEqual(["Be more specific"]);

    mockGroqContent(
      JSON.stringify({
        summary: "Solid technical answer.",
        areas: [{ area: "Technical depth", note: "Go deeper on internals." }],
      }),
    );
    const finished = await finishMockInterview(fake, USER_A, session.id);
    expect(finished.status).toBe("completed");
  });

  it("rejects a question set returned as a string instead of an array", async () => {
    useGroq();
    mockGroqContent(JSON.stringify({ questions: "technical: Explain indexing." }));
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    const session = await startMockInterview(fake, USER_A, { targetRole: "Backend Engineer" });
    expect(session.status).toBe("failed");
    expect(session.turns).toHaveLength(0);
  });

  it("rejects turn feedback scores returned as quoted strings instead of numbers", async () => {
    useGroq();
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    mockGroqContent(
      JSON.stringify({ questions: [{ category: "technical", question: "Explain indexing." }] }),
    );
    const session = await startMockInterview(fake, USER_A, { targetRole: "Backend Engineer" });

    mockGroqContent(
      JSON.stringify({
        quality: "80",
        relevance: 75,
        completeness: 70,
        communication: 85,
        technicalDepth: 60,
        areasToImprove: ["Be more specific"],
        followUpTopics: ["B-tree indexes"],
      }),
    );
    const turn = await submitMockInterviewAnswer(fake, USER_A, {
      sessionId: session.id,
      turnIndex: 0,
      answer: "An index speeds up lookups.",
    });
    expect(turn.feedback?.status).toBe("failed");
    expect(turn.feedback?.quality).toBeUndefined();
  });

  it("rejects overall feedback areas returned as a string instead of an array", async () => {
    useGroq();
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    mockGroqContent(
      JSON.stringify({ questions: [{ category: "technical", question: "Explain indexing." }] }),
    );
    const session = await startMockInterview(fake, USER_A, { targetRole: "Backend Engineer" });
    await submitMockInterviewAnswer(fake, USER_A, {
      sessionId: session.id,
      turnIndex: 0,
      answer: "An index speeds up lookups.",
    }).catch(() => null);

    mockGroqContent(
      JSON.stringify({
        summary: "Solid technical answer.",
        areas: "Technical depth: go deeper on internals.",
      }),
    );
    const finished = await finishMockInterview(fake, USER_A, session.id);
    expect(finished.status).toBe("failed");
    expect(finished.overallFeedback).toEqual([]);
  });
});
