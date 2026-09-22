/**
 * PREMIUM FEATURE 5 — Mock interviews.
 *
 * Text-based multi-turn flow: start (-> question set generated up front),
 * answer each question in turn, finish (-> overall feedback generated from
 * the actual answers given). Architected so a richer mode (voice/video)
 * could later plug in at the "turn" level without changing the session
 * shape -- but nothing here pretends voice/video exists today, since the
 * codebase has no such infrastructure.
 */
import { z } from "zod";
import { requireFeature } from "@/lib/subscription.server";
import {
  AiNotConfiguredError,
  AiRequestError,
  AiValidationError,
  currentModelLabel,
  generateStructured,
} from "@/lib/ai/provider.server";
import { buildUserAiContext, formatUserContext } from "@/lib/ai/user-context.server";
import { assertWithinRateLimit } from "@/lib/ai/run-workflow.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const questionCategory = z.enum([
  "technical",
  "behavioral",
  "situational",
  "project_based",
  "role_specific",
]);

const questionSetSchema = z.object({
  questions: z
    .array(z.object({ category: questionCategory, question: z.string() }))
    .min(1)
    .max(10),
});

const turnFeedbackSchema = z.object({
  quality: z.number().int().min(0).max(100),
  relevance: z.number().int().min(0).max(100),
  completeness: z.number().int().min(0).max(100),
  communication: z.number().int().min(0).max(100),
  technicalDepth: z.number().int().min(0).max(100),
  areasToImprove: z.array(z.string()).max(8),
  followUpTopics: z.array(z.string()).max(8),
});

const overallFeedbackSchema = z.object({
  summary: z.string(),
  areas: z.array(z.object({ area: z.string(), note: z.string() })).max(10),
});

export interface MockInterviewTurn {
  id: string;
  turnIndex: number;
  category: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  feedback: {
    status: "completed" | "failed";
    errorMessage?: string;
    quality?: number;
    relevance?: number;
    completeness?: number;
    communication?: number;
    technicalDepth?: number;
    areasToImprove?: string[];
    followUpTopics?: string[];
  } | null;
}

export interface MockInterviewSession {
  id: string;
  targetRole: string;
  status: "in_progress" | "completed" | "failed";
  errorMessage: string | null;
  questionCount: number;
  overallFeedback: { area: string; note: string }[];
  overallSummary: string | null;
  createdAt: string;
  completedAt: string | null;
  turns: MockInterviewTurn[];
}

function mapTurn(row: any): MockInterviewTurn {
  return {
    id: row.id,
    turnIndex: row.turn_index,
    category: row.category,
    question: row.question,
    answer: row.answer,
    answeredAt: row.answered_at,
    feedback: row.feedback ?? null,
  };
}

function mapSession(row: any, turns: any[]): MockInterviewSession {
  return {
    id: row.id,
    targetRole: row.target_role,
    status: row.status,
    errorMessage: row.error_message,
    questionCount: row.question_count,
    overallFeedback: row.overall_feedback ?? [],
    overallSummary: row.overall_summary,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    turns: turns.map(mapTurn).sort((a, b) => a.turnIndex - b.turnIndex),
  };
}

function errorMessageFor(error: unknown): string {
  if (error instanceof AiNotConfiguredError) return error.message;
  if (error instanceof AiRequestError) return error.message;
  if (error instanceof AiValidationError) return error.message;
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function startMockInterview(
  supabase: Client,
  userId: string,
  input: { targetRole: string; questionCount?: number | undefined },
): Promise<MockInterviewSession> {
  await requireFeature(supabase, userId, "mock_interviews");
  await assertWithinRateLimit(supabase, "mock_interview_sessions", userId);
  const questionCount = Math.min(Math.max(input.questionCount ?? 5, 3), 10);

  const { data: inserted, error: insertError } = await supabase
    .from("mock_interview_sessions")
    .insert({
      user_id: userId,
      target_role: input.targetRole,
      question_count: questionCount,
      status: "in_progress",
    })
    .select("*")
    .single();
  if (insertError || !inserted) throw new Error("Unable to start a mock interview.");

  try {
    const ctx = await buildUserAiContext(supabase, userId);
    const result = await generateStructured({
      system:
        "You are an interviewer conducting a mock interview. Generate a realistic, varied set of questions " +
        "for a specific role and candidate background, mixing technical, behavioral, situational, " +
        "project-based, and role-specific questions.",
      prompt: [
        formatUserContext(ctx),
        `Target role: ${input.targetRole}`,
        `Generate exactly ${questionCount} interview questions, each with a category. Return a JSON object ` +
          "with a single field, questions, which MUST be a JSON array of exactly " +
          `${questionCount} objects (never a string). Each object must have exactly two string fields: ` +
          'category (exactly one of "technical", "behavioral", "situational", "project_based", ' +
          '"role_specific", spelled exactly like that) and question.',
      ].join("\n"),
      schema: questionSetSchema,
      maxTokens: 1536,
    });

    const turnRows = result.questions.map((q, i) => ({
      session_id: inserted.id,
      user_id: userId,
      turn_index: i,
      category: q.category,
      question: q.question,
    }));
    const { data: insertedTurns, error: turnsError } = await supabase
      .from("mock_interview_turns")
      .insert(turnRows)
      .select("*");
    if (turnsError) throw new Error("Generated questions but couldn't save them.");

    await supabase
      .from("mock_interview_sessions")
      .update({ model: currentModelLabel() })
      .eq("id", inserted.id);

    return mapSession({ ...inserted, model: currentModelLabel() }, insertedTurns ?? []);
  } catch (error) {
    const errorMessage = errorMessageFor(error);
    await supabase
      .from("mock_interview_sessions")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", inserted.id);
    return mapSession({ ...inserted, status: "failed", error_message: errorMessage }, []);
  }
}

export async function submitMockInterviewAnswer(
  supabase: Client,
  userId: string,
  input: { sessionId: string; turnIndex: number; answer: string },
): Promise<MockInterviewTurn> {
  await requireFeature(supabase, userId, "mock_interviews");

  const { data: session, error: sessionError } = await supabase
    .from("mock_interview_sessions")
    .select("id, target_role, status")
    .eq("id", input.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError || !session) throw new Error("Mock interview session not found.");
  if (session.status !== "in_progress")
    throw new Error("This mock interview has already finished.");

  const { data: turn, error: turnError } = await supabase
    .from("mock_interview_turns")
    .select("*")
    .eq("session_id", input.sessionId)
    .eq("turn_index", input.turnIndex)
    .eq("user_id", userId)
    .maybeSingle();
  if (turnError || !turn) throw new Error("Question not found in this session.");

  await supabase
    .from("mock_interview_turns")
    .update({ answer: input.answer, answered_at: new Date().toISOString() })
    .eq("id", turn.id);

  let feedback: MockInterviewTurn["feedback"];
  try {
    const result = await generateStructured({
      system:
        "You are an interview coach giving direct, constructive feedback on a single interview answer. " +
        "Be honest -- do not inflate scores to be encouraging.",
      prompt: [
        `Role being interviewed for: ${(session as any).target_role}`,
        `Question (${turn.category}): ${turn.question}`,
        `Candidate's answer: ${input.answer}`,
        "Return a JSON object with exactly these fields: quality, relevance, completeness, communication, " +
          "and technicalDepth (each a JSON number, an integer from 0-100 -- never a quoted string like " +
          '"85"), areasToImprove (a JSON array of strings, one item per array element -- never a single ' +
          "string or comma-separated list), and followUpTopics (a JSON array of strings, one topic to study " +
          "per array element).",
      ].join("\n"),
      schema: turnFeedbackSchema,
      maxTokens: 1024,
    });
    feedback = { status: "completed", ...result };
  } catch (error) {
    feedback = { status: "failed", errorMessage: errorMessageFor(error) };
  }

  await supabase.from("mock_interview_turns").update({ feedback }).eq("id", turn.id);

  const { data: updatedTurn, error: reloadError } = await supabase
    .from("mock_interview_turns")
    .select("*")
    .eq("id", turn.id)
    .single();
  if (reloadError || !updatedTurn) throw new Error("Unable to load your feedback.");
  return mapTurn(updatedTurn);
}

export async function finishMockInterview(
  supabase: Client,
  userId: string,
  sessionId: string,
): Promise<MockInterviewSession> {
  await requireFeature(supabase, userId, "mock_interviews");

  const { data: session, error: sessionError } = await supabase
    .from("mock_interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError || !session) throw new Error("Mock interview session not found.");

  const { data: turns, error: turnsError } = await supabase
    .from("mock_interview_turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_index");
  if (turnsError) throw new Error("Unable to load your answers.");

  const answered = ((turns ?? []) as any[]).filter((t) => t.answer);

  let overallFeedback: { area: string; note: string }[] = [];
  let overallSummary: string | null = null;
  let errorMessage: string | null = null;

  if (answered.length === 0) {
    overallSummary = "No questions were answered, so there's nothing to give feedback on yet.";
  } else {
    try {
      const result = await generateStructured({
        system:
          "You are an interview coach summarizing a candidate's overall performance across a mock " +
          "interview, based only on the answers actually given.",
        prompt: [
          `Role: ${(session as any).target_role}`,
          "Answers given:",
          ...answered.map((t, i) => `${i + 1}. [${t.category}] ${t.question}\nAnswer: ${t.answer}`),
          "Return a JSON object with exactly these fields: summary (a JSON string, 2-4 sentences " +
            "summarizing overall performance) and areas (a JSON array of 3-6 objects, never a string -- " +
            "each object must have exactly two string fields: area and note).",
        ].join("\n\n"),
        schema: overallFeedbackSchema,
        maxTokens: 1536,
      });
      overallSummary = result.summary;
      overallFeedback = result.areas;
    } catch (error) {
      errorMessage = errorMessageFor(error);
    }
  }

  const { error: updateError } = await supabase
    .from("mock_interview_sessions")
    .update({
      status: errorMessage ? "failed" : "completed",
      error_message: errorMessage,
      overall_feedback: overallFeedback,
      overall_summary: overallSummary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (updateError) throw new Error("Unable to finish this session.");

  const { data: updated, error: reloadError } = await supabase
    .from("mock_interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (reloadError || !updated) throw new Error("Unable to load the finished session.");

  return mapSession(updated, turns ?? []);
}

export async function getMockInterviewSession(
  supabase: Client,
  userId: string,
  sessionId: string,
): Promise<MockInterviewSession | null> {
  await requireFeature(supabase, userId, "mock_interviews");
  const { data: session, error } = await supabase
    .from("mock_interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this session.");
  if (!session) return null;
  const { data: turns } = await supabase
    .from("mock_interview_turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_index");
  return mapSession(session, turns ?? []);
}

export async function listMockInterviewSessions(
  supabase: Client,
  userId: string,
): Promise<MockInterviewSession[]> {
  await requireFeature(supabase, userId, "mock_interviews");
  const { data: sessions, error } = await supabase
    .from("mock_interview_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Unable to load your mock interviews.");
  return ((sessions ?? []) as any[]).map((s) => mapSession(s, []));
}
