/**
 * Server-only AI abstraction backing every Pro AI feature (Part J of the
 * roadmap).
 *
 * Rules this file exists to uphold:
 *  - AI calls happen ONLY here, ONLY server-side. No secret key is ever
 *    read, referenced, or forwarded to client code.
 *  - Nothing fabricates a result. If no provider is configured, or the
 *    call fails, or the model's output doesn't validate against the
 *    caller's Zod schema, this throws a typed error the caller persists
 *    as an honest `status: 'failed'` row — never a fake success.
 *  - Structured output is enforced by (1) instructing the model to return
 *    JSON only and (2) validating every response against a Zod schema
 *    before it's trusted, so a malformed model reply can't leak
 *    un-validated shapes into the database or UI.
 *  - Provider is swappable: `AI_PROVIDER` selects the backend, and every
 *    provider implements the same `callProvider` signature, so adding a
 *    second provider later doesn't touch any of the 7 feature modules
 *    that call `generateStructured`.
 *
 * Provider migration (Groq): production now runs on Groq by default
 * (`AI_PROVIDER` defaults to "groq" when unset). Anthropic support is kept
 * intact behind the same abstraction — set `AI_PROVIDER="anthropic"` and
 * `ANTHROPIC_API_KEY` to fall back to it — since the point of this file is
 * that feature code never needs to know or care which vendor is active.
 */

import type { ZodType, ZodTypeDef } from "zod";

export type AiProviderName = "groq" | "anthropic";

/** Thrown when no AI provider is configured. Distinguished from other
 * failures so callers can render an honest "AI isn't configured yet"
 * state instead of a generic error. */
export class AiNotConfiguredError extends Error {
  readonly code = "AI_NOT_CONFIGURED";
  constructor(
    message = "AI provider isn't configured yet. Set an API key to enable this feature.",
  ) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

/** Thrown when the provider call itself fails (network, non-2xx, timeout). */
export class AiRequestError extends Error {
  readonly code = "AI_REQUEST_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "AiRequestError";
  }
}

/** Thrown when the provider responded but the content didn't validate
 * against the expected schema — never passed through as if it were valid. */
export class AiValidationError extends Error {
  readonly code = "AI_VALIDATION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "AiValidationError";
  }
}

export interface AiConfig {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
// Groq's general-purpose, currently-supported model for structured JSON
// workloads. See https://console.groq.com/docs/models for the current
// lineup — Groq retires older models over time, so this should be revisited
// if it ever appears on https://console.groq.com/docs/deprecations.
// Migrated from "llama-3.3-70b-versatile" to "openai/gpt-oss-120b".
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** Which env var holds the secret for each provider. Only the variable for
 * the *selected* provider is ever read. */
const PROVIDER_API_KEY_ENV: Record<AiProviderName, string> = {
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

function defaultModelFor(provider: AiProviderName): string {
  return provider === "groq" ? DEFAULT_GROQ_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

function isKnownProvider(value: string): value is AiProviderName {
  return value === "groq" || value === "anthropic";
}

/** Reads provider configuration from environment variables. Never throws
 * — callers use `isAiConfigured` / the returned null to decide how to
 * respond, since "not configured" is an expected, honest state in an
 * environment where no key has been added yet. */
export function getAiConfig(): AiConfig | null {
  const requestedProvider = process.env["AI_PROVIDER"];
  const provider =
    requestedProvider && isKnownProvider(requestedProvider) ? requestedProvider : "groq";
  const apiKey = process.env[PROVIDER_API_KEY_ENV[provider]];
  if (!apiKey) return null;
  const model = process.env["AI_MODEL"] ?? defaultModelFor(provider);
  const timeoutMs = Number(process.env["AI_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS);
  return {
    provider,
    apiKey,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}

interface GenerateStructuredParams<T> {
  /** Sets the model's role/behavior and hard constraints (JSON-only,
   * no fabrication instructions, etc). Combined with a standard
   * anti-fabrication clause below. */
  system: string;
  /** The actual task + user context, already assembled by the caller from
   * real data (profile, skills, resume text, etc) — never placeholder text. */
  prompt: string;
  /** Validates the parsed JSON response. On failure, throws
   * AiValidationError rather than returning a partially-trusted object. */
  // Input is `unknown` so schemas that normalize model output first (via
  // `z.preprocess`) are accepted; the OUTPUT type `T` is still enforced.
  schema: ZodType<T, ZodTypeDef, unknown>;
  maxTokens?: number | undefined;
}

const ANTI_FABRICATION_CLAUSE =
  "Respond with ONLY a single JSON object matching the requested shape — no prose, no markdown code fences, no commentary before or after. " +
  "Base every claim strictly on the information given to you in the prompt. Never invent skills, employers, job titles, salaries, dates, or " +
  "achievements that were not provided. If the given information is insufficient to respond confidently on a specific point, say so plainly " +
  'in that field (e.g. "Not enough information provided") rather than guessing. ' +
  "Match every field's requested type exactly. A field described as a list, or named in the plural, MUST be a JSON array with one item per " +
  "array element — never a single string, never a comma-separated string, and never one paragraph joining the items together with commas or " +
  '"and". If you have only one item for a list field, return it as a one-element array, not a bare string. A field described as a number ' +
  "must be a JSON number, not a numeric string. A field restricted to a fixed set of options must be exactly one of those option strings, " +
  "spelled exactly as given. Never omit a required field, and never collapse a nested object or array field into flat text.";

/** Replaces any literal occurrence of the API key in provider-supplied text
 * (error bodies, thrown messages) before it can reach a thrown error,
 * a log line, or a persisted `error_message` column. */
function redactSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[REDACTED]");
}

async function callAnthropic(
  config: AiConfig,
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system: `${system}\n\n${ANTI_FABRICATION_CLAUSE}`,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiRequestError(
        `AI provider returned ${response.status}. ${redactSecret(body.slice(0, 300), config.apiKey)}`,
      );
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new AiRequestError("AI provider returned an empty response.");
    return text;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiRequestError(`AI request timed out after ${config.timeoutMs}ms.`);
    }
    throw new AiRequestError(
      redactSecret(error instanceof Error ? error.message : "AI request failed.", config.apiKey),
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Groq's Chat Completions API is OpenAI-compatible:
 * https://console.groq.com/docs/api-reference#chat-create. JSON Object Mode
 * (`response_format: { type: "json_object" }`) is combined with the same
 * JSON-only system instruction used for Anthropic, then validated against
 * the caller's Zod schema exactly like every other provider — Groq is never
 * trusted to have matched the schema on its own. */
async function callGroq(
  config: AiConfig,
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\n\n${ANTI_FABRICATION_CLAUSE}` },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiRequestError(
        `AI provider returned ${response.status}. ${redactSecret(body.slice(0, 300), config.apiKey)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new AiRequestError("AI provider returned an empty response.");
    return text;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiRequestError(`AI request timed out after ${config.timeoutMs}ms.`);
    }
    throw new AiRequestError(
      redactSecret(error instanceof Error ? error.message : "AI request failed.", config.apiKey),
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Dispatches to the configured provider. Every provider returns the raw
 * text content of the model's reply — parsing/validation happens once,
 * centrally, in `generateStructured` below. */
async function callProvider(
  config: AiConfig,
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  switch (config.provider) {
    case "groq":
      return callGroq(config, system, prompt, maxTokens);
    case "anthropic":
      return callAnthropic(config, system, prompt, maxTokens);
  }
}

/** Strips a ```json ... ``` fence if the model added one despite
 * instructions not to, so a minor formatting slip doesn't fail parsing
 * that would otherwise succeed. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1]! : text;
}

/**
 * Calls the configured AI provider and validates the structured JSON
 * response against `schema`. Throws AiNotConfiguredError,
 * AiRequestError, or AiValidationError — callers should catch these and
 * persist an honest failed-status record with the error message, never a
 * fabricated result.
 */
export async function generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
  const config = getAiConfig();
  if (!config) throw new AiNotConfiguredError();

  const raw = await callProvider(config, params.system, params.prompt, params.maxTokens ?? 2048);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new AiValidationError("AI response was not valid JSON.");
  }

  const result = params.schema.safeParse(parsed);
  if (!result.success) {
    throw new AiValidationError(
      `AI response didn't match the expected shape: ${result.error.message}`,
    );
  }
  return result.data;
}

/** The model string persisted alongside a successful generation, so the
 * UI/audit trail can show what actually produced a given result. */
export function currentModelLabel(): string {
  return getAiConfig()?.model ?? "unconfigured";
}
