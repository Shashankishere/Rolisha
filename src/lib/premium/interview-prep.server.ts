/**
 * PREMIUM FEATURE 3 — Interview preparation.
 *
 * Uses real user context (target role, skills, projects) via
 * buildUserAiContext. Never claims a topic is guaranteed to come up in an
 * actual interview -- the schema's fields are phrased as "likely areas"
 * and the UI copy reinforces that (see the route component).
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import { runAiWorkflow } from "@/lib/ai/run-workflow.server";
import { buildUserAiContext, formatUserContext } from "@/lib/ai/user-context.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const prepSchema = z.object({
  technicalTopics: z.array(z.object({ topic: z.string(), why: z.string() })).max(15),
  behavioralTopics: z.array(z.object({ topic: z.string(), why: z.string() })).max(15),
  roleSpecificAreas: z.array(z.string()).max(15),
  checklist: z.array(z.string()).max(20),
  studyRecommendations: z.array(z.string()).max(15),
});

export type InterviewPrepResult = z.infer<typeof prepSchema>;

export interface InterviewPrepRow extends InterviewPrepResult {
  id: string;
  targetRole: string;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

function mapRow(row: any): InterviewPrepRow {
  return {
    id: row.id,
    targetRole: row.target_role,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    technicalTopics: row.technical_topics ?? [],
    behavioralTopics: row.behavioral_topics ?? [],
    roleSpecificAreas: row.role_specific_areas ?? [],
    checklist: row.checklist ?? [],
    studyRecommendations: row.study_recommendations ?? [],
  };
}

export async function generateInterviewPrep(
  supabase: Client,
  userId: string,
  input: { targetRole: string },
): Promise<InterviewPrepRow> {
  await requireFeature(supabase, userId, "interview_preparation");

  const ctx = await buildUserAiContext(supabase, userId);

  const system =
    "You are an interview coach. You build a structured preparation plan for a candidate's upcoming " +
    "interviews for a specific role, grounded in their real background. You never claim any topic is " +
    "guaranteed to be asked -- you describe likely/common areas based on the role and the candidate's gaps.";

  const prompt = [
    formatUserContext(ctx),
    `Preparing for: ${input.targetRole}`,
    "",
    "Return a JSON object with: technicalTopics (a JSON array of objects, each with exactly two string " +
      "fields: topic and why -- likely technical areas for this role, prioritizing gaps between the " +
      "candidate's logged skills and the role's typical requirements), behavioralTopics (a JSON array of " +
      "objects in the same { topic, why } shape -- likely behavioral themes, e.g. teamwork, ownership, " +
      "handling ambiguity), roleSpecificAreas (a JSON array of strings, one item per element -- specific " +
      "things unique to this role/level worth knowing), checklist (a JSON array of strings, one concrete " +
      "pre-interview step per element, e.g. review X, prepare a story about Y), and studyRecommendations (a " +
      "JSON array of strings, one recommendation per element, referencing the candidate's actual skill gaps " +
      "where relevant). Every array field must be a real JSON array, even with one item -- never a single " +
      "string or a comma-separated list.",
  ].join("\n");

  const outcome = await runAiWorkflow({
    supabase,
    table: "interview_prep_sessions",
    userId,
    insertRow: { user_id: userId, target_role: input.targetRole },
    system,
    prompt,
    schema: prepSchema,
    maxTokens: 2048,
    toColumns: (r) => ({
      technical_topics: r.technicalTopics,
      behavioral_topics: r.behavioralTopics,
      role_specific_areas: r.roleSpecificAreas,
      checklist: r.checklist,
      study_recommendations: r.studyRecommendations,
    }),
  });

  const { data, error } = await supabase
    .from("interview_prep_sessions")
    .select("*")
    .eq("id", outcome.id)
    .single();
  if (error || !data) throw new Error("Unable to load the preparation plan.");
  return mapRow(data);
}

export async function listInterviewPrepSessions(
  supabase: Client,
  userId: string,
): Promise<InterviewPrepRow[]> {
  await requireFeature(supabase, userId, "interview_preparation");
  const { data, error } = await supabase
    .from("interview_prep_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your preparation sessions.");
  return ((data ?? []) as any[]).map(mapRow);
}
