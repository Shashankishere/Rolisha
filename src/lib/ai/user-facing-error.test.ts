import { describe, expect, it } from "vitest";
import { AI_USER_FACING_ERRORS as F, toUserFacingAiError } from "@/lib/ai/user-facing-error";

const RAW_ZOD =
  'AI response didn\'t match the expected shape: [\n  {\n    "code": "invalid_type",\n    "expected": "array",\n    "received": "string",\n    "path": ["recommendations"],\n    "message": "Expected array, received string"\n  }\n]';

describe("toUserFacingAiError", () => {
  it("turns the exact production Zod dump into product copy", () => {
    const out = toUserFacingAiError(RAW_ZOD);
    expect(out).toBe(F.incompleteResponse);
    expect(out).not.toMatch(/invalid_type|Zod|expected shape|\[|\{/);
  });

  it.each([
    ["AI response was not valid JSON.", F.incompleteResponse],
    ["AI provider returned an empty response.", F.incompleteResponse],
    ["AI provider returned 503. upstream detail", F.serviceUnavailable],
    ["AI provider returned 429.", F.serviceUnavailable],
    ["fetch failed", F.serviceUnavailable],
    ["AI request timed out after 30s", F.timedOut],
    ["AI provider isn't configured yet. Set ANTHROPIC_API_KEY.", F.notConfigured],
    ["Generated successfully but could not be saved.", F.notSaved],
  ])("maps %j", (raw, expected) => {
    expect(toUserFacingAiError(raw)).toBe(expected);
  });

  it("never passes unknown internal text through to a customer", () => {
    expect(toUserFacingAiError('duplicate key value violates unique constraint "x_pkey"')).toBe(
      F.generic,
    );
    expect(toUserFacingAiError("network blip")).toBe(F.serviceUnavailable);
    expect(toUserFacingAiError("TypeError: cannot read properties of undefined")).toBe(F.generic);
  });

  it("falls back to generic copy for empty / missing input", () => {
    expect(toUserFacingAiError(null)).toBe(F.generic);
    expect(toUserFacingAiError(undefined)).toBe(F.generic);
    expect(toUserFacingAiError("   ")).toBe(F.generic);
  });

  it("is idempotent: its own messages come back unchanged", () => {
    for (const message of Object.values(F)) expect(toUserFacingAiError(message)).toBe(message);
  });

  it("the not-configured copy still says nothing was generated (honest, no API-key hint)", () => {
    expect(F.notConfigured).toMatch(/isn't configured/);
    expect(F.notConfigured).not.toMatch(/key|env|token/i);
  });
});
