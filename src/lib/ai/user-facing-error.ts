/**
 * Maps whatever error text an AI run produced -- a raw Zod dump, a provider
 * status line, a timeout, an internal exception message -- to calm,
 * product-level copy that is safe to show a customer.
 *
 * Deliberately a plain (non-`.server`) module: it is used both when a failed
 * run is PERSISTED (so raw internals never reach the browser in the first
 * place) and when a failed run is RENDERED (so rows already stored with a raw
 * message -- e.g. "AI response didn't match the expected shape: [...]" -- are
 * cleaned up too). The detailed error is logged server-side by the caller.
 *
 * It is idempotent: feeding it one of its own messages returns it unchanged.
 */

const FRIENDLY = {
  incompleteResponse: "We couldn't put together a complete response this time. Please try again.",
  timedOut: "This took longer than expected. Please try again.",
  serviceUnavailable:
    "The AI service is temporarily unavailable. Please try again in a few minutes.",
  notConfigured: "AI analysis isn't configured for this workspace yet, so nothing was generated.",
  notSaved: "We generated this but couldn't save it. Please try again.",
  generic: "We couldn't generate this right now. Please try again in a moment.",
} as const;

const FRIENDLY_MESSAGES: ReadonlySet<string> = new Set(Object.values(FRIENDLY));

export function toUserFacingAiError(raw: string | null | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return FRIENDLY.generic;
  if (FRIENDLY_MESSAGES.has(message)) return message; // already product copy

  // Structured-output problems: raw Zod issues, JSON parse failures, empty bodies.
  if (
    /didn't match the expected shape|invalid_type|invalid_enum|too_big|too_small|not valid JSON|empty response|Expected (array|string|number|object)/i.test(
      message,
    )
  ) {
    return FRIENDLY.incompleteResponse;
  }
  if (/timed out|timeout|took too long/i.test(message)) return FRIENDLY.timedOut;
  if (/not configured|isn't configured|api[_ ]?key|missing.*(key|token)/i.test(message)) {
    return FRIENDLY.notConfigured;
  }
  if (/could not be saved|couldn't be saved/i.test(message)) return FRIENDLY.notSaved;
  if (
    /AI provider|provider returned|\b(429|500|502|503|504)\b|network|fetch failed|rate limit/i.test(
      message,
    )
  ) {
    return FRIENDLY.serviceUnavailable;
  }
  // Unknown internal text (a database error, a stack-ish message, ...): never
  // pass it through to a customer.
  return FRIENDLY.generic;
}

export const AI_USER_FACING_ERRORS = FRIENDLY;
