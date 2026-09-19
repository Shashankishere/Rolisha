/**
 * PREMIUM FEATURE 7 — AI career recommendations.
 *
 * Uses the candidate's real profile (education, skills, projects,
 * experience, salary target, location, work-mode preference, roadmap
 * readiness) -- never invents jobs, salaries, employers, or
 * qualifications the candidate doesn't have.
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import { runAiWorkflow } from "@/lib/ai/run-workflow.server";
import { buildUserAiContext, formatUserContext } from "@/lib/ai/user-context.server";
import { loadProfile } from "@/lib/me.server";
import { EDUCATION_LABEL, WORK_MODE_LABEL, type EducationLevel, type WorkMode } from "@/lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const recommendationsSchema = z.object({
  recommendedRoles: z
    .array(
      z.object({
        role: z.string(),
        fitReason: z.string(),
        missingSkills: z.array(z.string()).max(15),
        nextSteps: z.array(z.string()).max(10),
        roadmapDirection: z.string(),
        suitableProjects: z.array(z.string()).max(10),
        jobSearchDirection: z.string(),
      }),
    )
    .min(1)
    .max(8),
});

export type CareerRecommendation = z.infer<
  typeof recommendationsSchema
>["recommendedRoles"][number];

export interface CareerRecommendationsRow {
  id: string;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  recommendedRoles: CareerRecommendation[];
  createdAt: string;
}

function mapRow(row: any): CareerRecommendationsRow {
  return {
    id: row.id,
    status: row.status,
    errorMessage: row.error_message,
    recommendedRoles: row.recommended_roles ?? [],
    createdAt: row.created_at,
  };
}

export async function generateCareerRecommendations(
  supabase: Client,
  userId: string,
): Promise<CareerRecommendationsRow> {
  await requireFeature(supabase, userId, "ai_career_recommendations");

  const [ctx, profile] = await Promise.all([
    buildUserAiContext(supabase, userId),
    loadProfile(supabase, userId),
  ]);

  const extraLines = [
    profile.degree || profile.fieldOfStudy
      ? `Field of study: ${[profile.degree, profile.fieldOfStudy].filter(Boolean).join(", ")}`
      : null,
    profile.salaryTarget
      ? `Target salary: ${profile.salaryTarget} ${profile.salaryCurrency}`
      : null,
    profile.country || profile.city
      ? `Location: ${[profile.city, profile.country].filter(Boolean).join(", ")}`
      : null,
    profile.workMode
      ? `Work mode preference: ${WORK_MODE_LABEL[profile.workMode as WorkMode]}`
      : null,
    profile.educationLevel
      ? `Education level: ${EDUCATION_LABEL[profile.educationLevel as EducationLevel]}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You are a career advisor recommending roles that genuinely fit a candidate's real background. Every " +
    "recommended role must be a real, recognized job title. Never invent employers, salary figures, or " +
    "qualifications the candidate doesn't have -- if salary/location data wasn't given, don't estimate one.";

  const prompt = [
    formatUserContext(ctx),
    extraLines,
    "",
    "Recommend 3-6 roles that fit this candidate's real background well (including their current target " +
      "role if it's still a good fit, and 1-2 adjacent alternatives). Return a JSON object with a single " +
      "field, recommendedRoles, which MUST be a JSON array (never a string) of 3-6 objects. Each object must " +
      "have exactly these fields: role (a JSON string, the job title), fitReason (a JSON string explaining " +
      "why it fits, referencing their actual skills/education/experience), missingSkills (a JSON array of " +
      "strings, one skill per array element -- use an empty array if there are none, never a comma-separated " +
      "string), nextSteps (a JSON array of strings, one concrete action per array element), roadmapDirection " +
      "(a JSON string describing how their learning roadmap should be shaped for this role), suitableProjects " +
      "(a JSON array of strings, one portfolio project idea per array element), jobSearchDirection (a JSON " +
      "string on what to look for/how to search).",
  ]
    .filter(Boolean)
    .join("\n");

  const outcome = await runAiWorkflow({
    supabase,
    table: "ai_career_recommendations",
    userId,
    insertRow: { user_id: userId },
    system,
    prompt,
    schema: recommendationsSchema,
    maxTokens: 3072,
    toColumns: (r) => ({ recommended_roles: r.recommendedRoles }),
  });

  const { data, error } = await supabase
    .from("ai_career_recommendations")
    .select("*")
    .eq("id", outcome.id)
    .single();
  if (error || !data) throw new Error("Unable to load your recommendations.");
  return mapRow(data);
}

export async function listCareerRecommendations(
  supabase: Client,
  userId: string,
): Promise<CareerRecommendationsRow[]> {
  await requireFeature(supabase, userId, "ai_career_recommendations");
  const { data, error } = await supabase
    .from("ai_career_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your career recommendations.");
  return ((data ?? []) as any[]).map(mapRow);
}
