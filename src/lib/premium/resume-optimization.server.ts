/**
 * PREMIUM FEATURE 2 — Resume optimization.
 *
 * Always additive: the user's original resume_text is stored as-is and
 * never mutated. Suggestions are returned as CURRENT vs RECOMMENDED pairs
 * per section so the user reviews and copies what they want — nothing is
 * applied automatically.
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import { runAiWorkflow } from "@/lib/ai/run-workflow.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const optimizationSchema = z.object({
  summary: z.string(),
  sections: z
    .array(
      z.object({
        sectionName: z.string(),
        currentText: z.string(),
        recommendedText: z.string(),
        rationale: z.string(),
      }),
    )
    .max(12),
  keywordImprovements: z.array(z.string()).max(20),
});

export type ResumeOptimizationResult = z.infer<typeof optimizationSchema>;

export interface ResumeOptimizationRow extends ResumeOptimizationResult {
  id: string;
  targetRole: string;
  resumeText: string;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

function mapRow(row: any): ResumeOptimizationRow {
  return {
    id: row.id,
    targetRole: row.target_role,
    resumeText: row.resume_text,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    summary: row.summary ?? "",
    sections: row.sections ?? [],
    keywordImprovements: row.keyword_improvements ?? [],
  };
}

export async function optimizeResume(
  supabase: Client,
  userId: string,
  input: { targetRole: string; resumeText: string },
): Promise<ResumeOptimizationRow> {
  await requireFeature(supabase, userId, "resume_optimization");

  const system =
    "You are a professional resume writer. You identify weak sections of a resume and rewrite them to be " +
    "stronger, more quantified, and better aligned with a target role -- without inventing facts, employers, " +
    "titles, dates, or achievements the candidate didn't provide. If a section can't honestly be strengthened " +
    "without more information, say so in its rationale rather than fabricating detail.";

  const prompt = [
    `Target role: ${input.targetRole}`,
    "",
    "Current resume text:",
    "---",
    input.resumeText,
    "---",
    "",
    "Identify the 3-8 weakest or most improvable sections (e.g. summary, a specific job's bullet points, " +
      "skills list). Return a JSON object with exactly these fields: sections (a JSON array of 3-8 objects, " +
      "never a string -- each object must have exactly these string fields: sectionName, currentText (quoted " +
      "verbatim from the resume), recommendedText (your improved rewrite, using only facts present in " +
      "currentText, with stronger action verbs / quantification where the original already implies a number, " +
      "and better alignment to the target role's likely keywords), and rationale (why this rewrite is " +
      "stronger)), summary (a JSON string, 2-3 sentences on overall optimization strategy), and " +
      "keywordImprovements (a JSON array of strings, one keyword per array element -- role-relevant keywords " +
      "worth weaving in that are currently missing, never a comma-separated string).",
  ].join("\n");

  const outcome = await runAiWorkflow({
    supabase,
    table: "resume_optimizations",
    userId,
    insertRow: { user_id: userId, target_role: input.targetRole, resume_text: input.resumeText },
    system,
    prompt,
    schema: optimizationSchema,
    maxTokens: 3072,
    toColumns: (r) => ({
      summary: r.summary,
      sections: r.sections,
      keyword_improvements: r.keywordImprovements,
    }),
  });

  const { data, error } = await supabase
    .from("resume_optimizations")
    .select("*")
    .eq("id", outcome.id)
    .single();
  if (error || !data) throw new Error("Unable to load the optimization result.");
  return mapRow(data);
}

export async function listResumeOptimizations(
  supabase: Client,
  userId: string,
): Promise<ResumeOptimizationRow[]> {
  await requireFeature(supabase, userId, "resume_optimization");
  const { data, error } = await supabase
    .from("resume_optimizations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your resume optimizations.");
  return ((data ?? []) as any[]).map(mapRow);
}
