/**
 * PREMIUM FEATURE 6 — Career-switch analysis.
 *
 * Compares a user-described current role/background against a target
 * role, using the candidate's real logged skills/projects for grounding.
 * Explicitly never promises guaranteed employment or a guaranteed
 * timeline (enforced via the system prompt and reinforced in the UI copy).
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import { runAiWorkflow } from "@/lib/ai/run-workflow.server";
import { buildUserAiContext, formatUserContext } from "@/lib/ai/user-context.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const switchSchema = z.object({
  summary: z.string(),
  transferableSkills: z.array(z.object({ skill: z.string(), howItTransfers: z.string() })).max(20),
  missingSkills: z.array(z.string()).max(20),
  experienceGaps: z.array(z.string()).max(15),
  projectGaps: z.array(z.string()).max(15),
  learningRequirements: z.array(z.string()).max(15),
  estimatedRoadmap: z.array(z.object({ phase: z.string(), focus: z.string() })).max(10),
  recommendedProjects: z.array(z.string()).max(10),
  jobReadinessGaps: z.array(z.string()).max(15),
});

export type CareerSwitchResult = z.infer<typeof switchSchema>;

export interface CareerSwitchAnalysisRow extends CareerSwitchResult {
  id: string;
  currentRole: string;
  targetRole: string;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

function mapRow(row: any): CareerSwitchAnalysisRow {
  return {
    id: row.id,
    currentRole: row.current_role_name,
    targetRole: row.target_role,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    summary: row.summary ?? "",
    transferableSkills: row.transferable_skills ?? [],
    missingSkills: row.missing_skills ?? [],
    experienceGaps: row.experience_gaps ?? [],
    projectGaps: row.project_gaps ?? [],
    learningRequirements: row.learning_requirements ?? [],
    estimatedRoadmap: row.estimated_roadmap ?? [],
    recommendedProjects: row.recommended_projects ?? [],
    jobReadinessGaps: row.job_readiness_gaps ?? [],
  };
}

export async function analyzeCareerSwitch(
  supabase: Client,
  userId: string,
  input: { currentRole: string; targetRole: string },
): Promise<CareerSwitchAnalysisRow> {
  await requireFeature(supabase, userId, "career_switch_analysis");

  const ctx = await buildUserAiContext(supabase, userId);

  const system =
    "You are a career transition advisor. You compare a candidate's current role/background against a " +
    "target role and produce a clear, honest transition plan. You NEVER promise guaranteed employment or a " +
    "guaranteed timeline -- describe estimated phases and effort, not certainties.";

  const prompt = [
    `Current role/background (as described by the candidate): ${input.currentRole}`,
    `Target role: ${input.targetRole}`,
    formatUserContext(ctx),
    "",
    "Return a JSON object with exactly these fields: summary (a JSON string, 2-3 sentences on overall " +
      "transition feasibility, with appropriate hedging -- no guarantees), transferableSkills (a JSON array " +
      "of objects, each with exactly two string fields: skill and howItTransfers -- never a string, never a " +
      "flat list of skill names), missingSkills (a JSON array of strings, one skill per element), " +
      "experienceGaps (a JSON array of strings, one gap per element), projectGaps (a JSON array of strings -- " +
      "what portfolio evidence is missing, one item per element), learningRequirements (a JSON array of " +
      "strings, one requirement per element), estimatedRoadmap (a JSON array of objects, each with exactly " +
      "two string fields: phase and focus, describing a rough non-committal phased plan), " +
      "recommendedProjects (a JSON array of strings, one specific project idea per element), " +
      "jobReadinessGaps (a JSON array of strings, one gap per element -- what would still be missing before " +
      "applying). Every array field must be a JSON array even when it has only one item, and every item must " +
      "be its own array element -- never join items into one string.",
  ].join("\n");

  const outcome = await runAiWorkflow({
    supabase,
    table: "career_switch_analyses",
    userId,
    insertRow: {
      user_id: userId,
      current_role_name: input.currentRole,
      target_role: input.targetRole,
    },
    system,
    prompt,
    schema: switchSchema,
    maxTokens: 3072,
    toColumns: (r) => ({
      summary: r.summary,
      transferable_skills: r.transferableSkills,
      missing_skills: r.missingSkills,
      experience_gaps: r.experienceGaps,
      project_gaps: r.projectGaps,
      learning_requirements: r.learningRequirements,
      estimated_roadmap: r.estimatedRoadmap,
      recommended_projects: r.recommendedProjects,
      job_readiness_gaps: r.jobReadinessGaps,
    }),
  });

  const { data, error } = await supabase
    .from("career_switch_analyses")
    .select("*")
    .eq("id", outcome.id)
    .single();
  if (error || !data) throw new Error("Unable to load the career switch analysis.");
  return mapRow(data);
}

export async function listCareerSwitchAnalyses(
  supabase: Client,
  userId: string,
): Promise<CareerSwitchAnalysisRow[]> {
  await requireFeature(supabase, userId, "career_switch_analysis");
  const { data, error } = await supabase
    .from("career_switch_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your career switch analyses.");
  return ((data ?? []) as any[]).map(mapRow);
}
