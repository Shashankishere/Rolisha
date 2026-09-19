/**
 * PREMIUM FEATURE 1 — AI resume analysis.
 *
 * Gated server-side by `requireFeature(..., "resume_analysis")` before any
 * AI call or persistence happens — a Free/Pro user calling this function
 * directly (bypassing the UI entirely) gets the same UpgradeRequiredError
 * the UI renders as an upgrade prompt.
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import { loadProfile, loadRequiredSkills, loadUserSkills } from "@/lib/me.server";
import { runAiWorkflow } from "@/lib/ai/run-workflow.server";
import { normalizeStringList } from "@/lib/ai/normalize-list";
import { toUserFacingAiError } from "@/lib/ai/user-facing-error";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export const analysisSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  atsScore: z.number().int().min(0).max(100),
  atsNotes: z.string(),
  skillsDetected: z.array(z.string()).max(40),
  missingSkills: z.array(z.string()).max(40),
  strengths: z.array(z.string()).max(15),
  weaknesses: z.array(z.string()).max(15),
  experienceRelevance: z.string(),
  educationRelevance: z.string(),
  keywordCoverage: z.array(z.object({ keyword: z.string(), covered: z.boolean() })).max(40),
  jobDescriptionAlignment: z.string(),
  // Models sometimes return the advice as ONE prose string (or a JSON array
  // serialized in a string) even when asked for an array. Re-shape that
  // representation difference before validating; validation itself is still
  // strict -- `string[]`, max 15 -- and anything unrecognisable still fails.
  recommendations: z.preprocess(normalizeStringList, z.array(z.string()).max(15)),
});

export type ResumeAnalysisResult = z.infer<typeof analysisSchema>;

export interface ResumeAnalysisRow extends ResumeAnalysisResult {
  id: string;
  targetRole: string;
  resumeText: string;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  model: string | null;
  createdAt: string;
}

function mapRow(row: any): ResumeAnalysisRow {
  return {
    id: row.id,
    targetRole: row.target_role,
    resumeText: row.resume_text,
    status: row.status,
    // Rows persisted before errors were humanized may hold raw internals.
    errorMessage: row.error_message ? toUserFacingAiError(row.error_message) : null,
    model: row.model,
    createdAt: row.created_at,
    overallScore: row.overall_score ?? 0,
    atsScore: row.ats_score ?? 0,
    atsNotes: row.ats_notes ?? "",
    skillsDetected: row.skills_detected ?? [],
    missingSkills: row.missing_skills ?? [],
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    experienceRelevance: row.experience_relevance ?? "",
    educationRelevance: row.education_relevance ?? "",
    keywordCoverage: row.keyword_coverage ?? [],
    jobDescriptionAlignment: row.job_description_alignment ?? "",
    recommendations: row.recommendations ?? [],
  };
}

export async function analyzeResume(
  supabase: Client,
  userId: string,
  input: { targetRole: string; resumeText: string },
): Promise<ResumeAnalysisRow> {
  await requireFeature(supabase, userId, "resume_analysis");

  const profile = await loadProfile(supabase, userId);
  const skills = await loadUserSkills(supabase, userId);
  const required = await loadRequiredSkills(supabase, profile.careerId);

  const system =
    "You are a career coach specializing in resume review. You analyze resumes against a specific " +
    "target role and produce a structured, honest assessment. You never inflate scores to be encouraging " +
    "-- accuracy matters more than positivity.";

  const prompt = [
    `Target role: ${input.targetRole}`,
    profile.experience ? `Candidate's stated experience level: ${profile.experience}` : null,
    required.length > 0
      ? `Skills this role typically requires: ${required.map((r) => r.name).join(", ")}`
      : null,
    skills.length > 0
      ? `Skills the candidate has logged in their profile: ${skills.map((s) => s.name).join(", ")}`
      : null,
    "",
    "Resume text:",
    "---",
    input.resumeText,
    "---",
    "",
    "Return a JSON object with exactly these fields: overallScore (0-100), atsScore (0-100, how well an " +
      "applicant-tracking system would parse this resume), atsNotes (1-2 sentences), skillsDetected " +
      "(skills actually evidenced in the resume text), missingSkills (skills this role needs that are absent " +
      "from the resume), strengths (a JSON array of short strings, one strength per array element -- " +
      'e.g. ["Strong SQL fundamentals", "Clear, quantified project descriptions"] -- never a single ' +
      "string or one combined paragraph), weaknesses (a JSON array of short strings, one weakness per array " +
      "element, in the same style as strengths -- never a single string or one combined paragraph), " +
      "experienceRelevance (1-2 sentences), educationRelevance " +
      "(1-2 sentences), keywordCoverage (array of { keyword, covered } for the most important role keywords), " +
      "jobDescriptionAlignment (1-2 sentences on fit for this target role), recommendations (a JSON array " +
      "of short, actionable strings, one specific next step per array element, in the same style as " +
      'strengths -- e.g. ["Quantify the impact of your SQL project", "Add a dashboard project to your ' +
      'portfolio"] -- never a single string or one combined paragraph).',
  ]
    .filter(Boolean)
    .join("\n");

  const outcome = await runAiWorkflow({
    supabase,
    table: "resume_analyses",
    userId,
    insertRow: { user_id: userId, target_role: input.targetRole, resume_text: input.resumeText },
    system,
    prompt,
    schema: analysisSchema,
    maxTokens: 2048,
    toColumns: (r) => ({
      overall_score: r.overallScore,
      ats_score: r.atsScore,
      ats_notes: r.atsNotes,
      skills_detected: r.skillsDetected,
      missing_skills: r.missingSkills,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
      experience_relevance: r.experienceRelevance,
      education_relevance: r.educationRelevance,
      keyword_coverage: r.keywordCoverage,
      job_description_alignment: r.jobDescriptionAlignment,
      recommendations: r.recommendations,
    }),
  });

  const { data, error } = await supabase
    .from("resume_analyses")
    .select("*")
    .eq("id", outcome.id)
    .single();
  if (error || !data) throw new Error("Unable to load the analysis result.");
  return mapRow(data);
}

export async function listResumeAnalyses(
  supabase: Client,
  userId: string,
): Promise<ResumeAnalysisRow[]> {
  await requireFeature(supabase, userId, "resume_analysis");
  const { data, error } = await supabase
    .from("resume_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your resume analyses.");
  return ((data ?? []) as any[]).map(mapRow);
}

export async function getResumeAnalysis(
  supabase: Client,
  userId: string,
  id: string,
): Promise<ResumeAnalysisRow | null> {
  await requireFeature(supabase, userId, "resume_analysis");
  const { data, error } = await supabase
    .from("resume_analyses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this analysis.");
  return data ? mapRow(data) : null;
}
