/**
 * Shared "insert pending row -> call AI -> update to completed/failed" flow
 * used by all 7 Pro AI features, so each feature module only has to
 * define its own prompt, schema, and column mapping instead of
 * re-implementing the same persistence/error-handling shape 7 times.
 *
 * The row is always created first (status: 'pending') so a crash between
 * the AI call and the update still leaves a real, visible record rather
 * than silently losing the user's request — and so `AiNotConfiguredError`
 * / provider failures land as a normal 'failed' row with a real message,
 * not a thrown error that leaves nothing for the UI to show.
 *
 * Rate limiting: being on Pro gates *access* to these features but
 * says nothing about *frequency* -- without a cap here, a single account
 * (compromised or otherwise) could script unlimited AI calls against any
 * Pro-gated table and run up real provider cost with no application-level
 * ceiling. This enforces a per-user, per-feature-table rolling window
 * before the pending row is even created (so a throttled call never
 * reaches the AI provider at all), using each table's own history as the
 * counter -- no new infrastructure (Redis/KV) required.
 */

import {
  AiNotConfiguredError,
  AiRequestError,
  AiValidationError,
  generateStructured,
} from "@/lib/ai/provider.server";
import type { ZodType, ZodTypeDef } from "zod";
import { toUserFacingAiError } from "@/lib/ai/user-facing-error";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/** Thrown when a user has made too many AI requests against a given
 * feature table too recently. Distinguished from other failures so the UI
 * can render "you're going too fast, try again in a bit" instead of a
 * generic error or a fake result. */
export class AiRateLimitError extends Error {
  readonly code = "AI_RATE_LIMITED";
  constructor(
    message = "You've made a lot of requests to this feature recently. Please wait a bit before trying again.",
  ) {
    super(message);
    this.name = "AiRateLimitError";
  }
}

/** Max AI generations a single user may start against a single Pro-gated
 * feature table within the rolling window below. Generous enough that no
 * legitimate user doing normal iterative work (re-running an analysis
 * after updating their resume, trying a few mock interview rounds) ever
 * notices it, tight enough to bound worst-case cost from one account. */
const AI_RATE_LIMIT_MAX_REQUESTS = 8;
const AI_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function assertWithinRateLimit(supabase: Client, table: string, userId: string) {
  const since = new Date(Date.now() - AI_RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  // A rate-limit check that itself fails open on a transient DB error
  // rather than blocking the user entirely -- this is an abuse guard, not
  // the primary authorization boundary, so failing open here is the safer
  // default for legitimate users.
  if (error) return;
  if (typeof count === "number" && count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    throw new AiRateLimitError();
  }
}

interface RunAiWorkflowParams<T> {
  supabase: Client;
  table: string;
  /** Whose request this is, for rate limiting. Must match the `user_id`
   * column value being inserted in `insertRow`. */
  userId: string;
  /** Row to insert up-front, status omitted (always starts 'pending'). */
  insertRow: Record<string, unknown>;
  system: string;
  prompt: string;
  schema: ZodType<T, ZodTypeDef, unknown>;
  maxTokens?: number | undefined;
  /** Maps the validated AI result onto the table's columns for the
   * completed-state UPDATE. */
  toColumns: (result: T) => Record<string, unknown>;
}

export interface AiWorkflowResult<T> {
  id: string;
  status: "completed" | "failed";
  errorMessage: string | null;
  result: T | null;
}

function technicalMessageFor(error: unknown): string {
  if (error instanceof AiNotConfiguredError) return error.message;
  if (error instanceof AiRequestError) return error.message;
  if (error instanceof AiValidationError) return error.message;
  return error instanceof Error ? error.message : "Something went wrong generating this.";
}

export async function runAiWorkflow<T>(
  params: RunAiWorkflowParams<T>,
): Promise<AiWorkflowResult<T>> {
  const { supabase, table, userId, insertRow, system, prompt, schema, maxTokens, toColumns } =
    params;

  await assertWithinRateLimit(supabase, table, userId);

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .insert({ ...insertRow, status: "pending" })
    .select("id")
    .single();
  if (insertError || !inserted) {
    throw new Error(`Unable to start this request (${table}).`);
  }
  const id = (inserted as { id: string }).id;

  try {
    const result = await generateStructured({ system, prompt, schema, maxTokens });
    const { model } = await import("@/lib/ai/provider.server").then((m) => ({
      model: m.currentModelLabel(),
    }));
    const { error: updateError } = await supabase
      .from(table)
      .update({ status: "completed", error_message: null, model, ...toColumns(result) })
      .eq("id", id);
    if (updateError) {
      // The AI call succeeded but we couldn't save it — surface as failed
      // rather than claim success with nothing to show.
      await supabase
        .from(table)
        .update({
          status: "failed",
          error_message: "Generated successfully but could not be saved.",
        })
        .eq("id", id);
      return {
        id,
        status: "failed",
        errorMessage: "Generated successfully but could not be saved.",
        result: null,
      };
    }
    return { id, status: "completed", errorMessage: null, result };
  } catch (error) {
    // The technical detail (raw Zod issues, provider status/body, ...) goes to
    // the server log for debugging. It is deliberately NOT persisted or
    // returned: `error_message` is rendered to the customer as-is. Only the
    // error's own text is logged -- never the prompt, resume, or user input.
    console.error(
      `[ai-workflow] table=${table} failed: ${technicalMessageFor(error).slice(0, 600)}`,
    );
    const errorMessage = toUserFacingAiError(technicalMessageFor(error));
    await supabase
      .from(table)
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", id);
    return { id, status: "failed", errorMessage, result: null };
  }
}
