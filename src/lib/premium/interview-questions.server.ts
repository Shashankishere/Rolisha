/**
 * PREMIUM FEATURE 4 — Personalized interview questions.
 *
 * Grounded in the user's real skills/projects/target role, and optionally
 * a specific saved job (title + description + required skills) when
 * jobId is provided. Never invents details about the user or the job.
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import { runAiWorkflow } from "@/lib/ai/run-workflow.server";
import { buildUserAiContext, formatUserContext } from "@/lib/ai/user-context.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const questionCategory = z.enum([
  "technical",
  "behavioral",
  "situational",
  "project_based",
  "role_specific",
]);

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        category: questionCategory,
        question: z.string(),
        whyItMatters: z.string().optional(),
        evaluates: z.string().optional(),
        answerGuidance: z.string().optional(),
        prepTopic: z.string().optional(),
      }),
    )
    .min(1)
    .max(25),
});

export type InterviewQuestion = z.infer<typeof questionsSchema>["questions"][number];

export interface InterviewQuestionSetRow {
  id: string;
  targetRole: string;
  jobId: string | null;
  status: "pending" | "completed" | "failed";
  errorMessage: string | null;
  questions: InterviewQuestion[];
  createdAt: string;
}

function mapRow(row: any): InterviewQuestionSetRow {
  return {
    id: row.id,
    targetRole: row.target_role,
    jobId: row.job_id,
    status: row.status,
    errorMessage: row.error_message,
    questions: row.questions ?? [],
    createdAt: row.created_at,
  };
}

async function loadJobContext(supabase: Client, jobId: string | undefined): Promise<string | null> {
  if (!jobId) return null;
  const { data: job } = await supabase
    .from("jobs")
    .select("title, company, description")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return null;
  const { data: skillRows } = await supabase
    .from("job_skills")
    .select("is_required, skills(name)")
    .eq("job_id", jobId);
  const required = ((skillRows ?? []) as any[])
    .filter((r) => r.is_required)
    .map((r) => r.skills?.name)
    .filter(Boolean);
  return [
    `Specific job: ${(job as any).title} at ${(job as any).company}`,
    required.length > 0 ? `Required skills for this job: ${required.join(", ")}` : null,
    (job as any).description
      ? `Job description excerpt: ${(job as any).description.slice(0, 800)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateInterviewQuestions(
  supabase: Client,
  userId: string,
  input: { targetRole: string; jobId?: string | undefined },
): Promise<InterviewQuestionSetRow> {
  await requireFeature(supabase, userId, "personalized_interview_questions");

  const ctx = await buildUserAiContext(supabase, userId);
  const jobContext = await loadJobContext(supabase, input.jobId);

  const system =
    "You are an interviewer preparing personalized practice questions for a specific candidate and role. " +
    "Ground every question in the real details you're given -- their actual skills and projects, and the " +
    "specific job if one is provided. Never invent facts about the candidate.";

  const prompt = [
    formatUserContext(ctx),
    jobContext,
    `Target role: ${input.targetRole}`,
    "",
    "Generate 8-15 interview questions across these categories: technical, behavioral, situational, " +
      "project_based (reference the candidate's actual logged/completed projects when possible), and " +
      "role_specific. Return a JSON object with a single field, questions, which MUST be a JSON array of " +
      "8-15 objects (never a string). Each object must have: category (a JSON string, exactly one of " +
      '"technical", "behavioral", "situational", "project_based", "role_specific" -- spelled exactly like ' +
      "that, lowercase with underscores), question (a JSON string), and, when you have a good answer for " +
      "them, whyItMatters, evaluates, answerGuidance, and prepTopic (each a JSON string -- what this question " +
      "is really probing for, what the interviewer is evaluating, how to structure a strong answer, and what " +
      "to review beforehand, respectively). Omit any of those four optional fields entirely if you don't have " +
      "a specific answer for it -- never send null or an empty string in their place.",
  ]
    .filter(Boolean)
    .join("\n");

  const outcome = await runAiWorkflow({
    supabase,
    table: "interview_question_sets",
    userId,
    insertRow: { user_id: userId, target_role: input.targetRole, job_id: input.jobId ?? null },
    system,
    prompt,
    schema: questionsSchema,
    maxTokens: 3072,
    toColumns: (r) => ({ questions: r.questions }),
  });

  const { data, error } = await supabase
    .from("interview_question_sets")
    .select("*")
    .eq("id", outcome.id)
    .single();
  if (error || !data) throw new Error("Unable to load the question set.");
  return mapRow(data);
}

export async function listInterviewQuestionSets(
  supabase: Client,
  userId: string,
): Promise<InterviewQuestionSetRow[]> {
  await requireFeature(supabase, userId, "personalized_interview_questions");
  const { data, error } = await supabase
    .from("interview_question_sets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your interview question sets.");
  return ((data ?? []) as any[]).map(mapRow);
}
