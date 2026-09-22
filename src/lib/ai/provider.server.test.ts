import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AiNotConfiguredError,
  AiRequestError,
  AiValidationError,
  generateStructured,
  getAiConfig,
  isAiConfigured,
} from "@/lib/ai/provider.server";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function clearAiEnv() {
  delete process.env["AI_PROVIDER"];
  delete process.env["GROQ_API_KEY"];
  delete process.env["ANTHROPIC_API_KEY"];
  delete process.env["AI_MODEL"];
  delete process.env["AI_TIMEOUT_MS"];
}

describe("AI provider configuration", () => {
  it("reports not configured when no API key is set (the expected state until one is added)", () => {
    clearAiEnv();
    expect(isAiConfigured()).toBe(false);
    expect(getAiConfig()).toBeNull();
  });

  it("generateStructured throws AiNotConfiguredError rather than fabricating a result", async () => {
    clearAiEnv();
    await expect(
      generateStructured({
        system: "test",
        prompt: "test",
        schema: z.object({ ok: z.boolean() }),
      }),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
  });

  it("defaults to the groq provider when AI_PROVIDER is unset", () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    expect(isAiConfigured()).toBe(true);
    expect(getAiConfig()?.provider).toBe("groq");
    expect(getAiConfig()?.model).toBe("openai/gpt-oss-120b");
  });

  it("selects groq explicitly via AI_PROVIDER=groq", () => {
    clearAiEnv();
    process.env["AI_PROVIDER"] = "groq";
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    expect(getAiConfig()?.provider).toBe("groq");
  });

  it("is not configured when AI_PROVIDER=groq but GROQ_API_KEY is missing, even if ANTHROPIC_API_KEY is set", () => {
    clearAiEnv();
    process.env["AI_PROVIDER"] = "groq";
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-test-key";
    expect(isAiConfigured()).toBe(false);
    expect(getAiConfig()).toBeNull();
  });

  it("still supports anthropic as an explicit fallback provider", () => {
    clearAiEnv();
    process.env["AI_PROVIDER"] = "anthropic";
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-test-key";
    expect(getAiConfig()?.provider).toBe("anthropic");
    expect(getAiConfig()?.model).toBe("claude-sonnet-4-6");
  });

  it("respects a configured AI_MODEL override instead of the provider default", () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    process.env["AI_MODEL"] = "llama-3.1-8b-instant";
    expect(getAiConfig()?.model).toBe("llama-3.1-8b-instant");
  });

  it("falls back to groq for an unrecognized AI_PROVIDER value", () => {
    clearAiEnv();
    process.env["AI_PROVIDER"] = "some-unknown-vendor";
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    expect(getAiConfig()?.provider).toBe("groq");
  });
});

const schema = z.object({ ok: z.boolean(), note: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("generateStructured via Groq", () => {
  it("parses and validates a successful Groq response", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: JSON.stringify({ ok: true, note: "fine" }) } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({ system: "sys", prompt: "prompt", schema });
    expect(result).toEqual({ ok: true, note: "fine" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer gsk-test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("strips a stray ```json code fence before validating", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [
            {
              message: { content: "```json\n" + JSON.stringify({ ok: true, note: "x" }) + "\n```" },
            },
          ],
        }),
      ),
    );
    const result = await generateStructured({ system: "sys", prompt: "prompt", schema });
    expect(result).toEqual({ ok: true, note: "x" });
  });

  it("rejects a response that doesn't match the caller's schema (never passed through un-validated)", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: JSON.stringify({ ok: "not-a-bool" }) } }],
        }),
      ),
    );
    await expect(
      generateStructured({ system: "sys", prompt: "prompt", schema }),
    ).rejects.toBeInstanceOf(AiValidationError);
  });

  it("rejects a response that isn't valid JSON at all", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "not json" } }] })),
    );
    await expect(
      generateStructured({ system: "sys", prompt: "prompt", schema }),
    ).rejects.toBeInstanceOf(AiValidationError);
  });

  it("surfaces a non-2xx Groq response as AiRequestError without leaking the API key", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-super-secret-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Unauthorized: bad key gsk-super-secret-key", { status: 401 }),
        ),
    );
    const error = await generateStructured({ system: "sys", prompt: "prompt", schema }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AiRequestError);
    const message = (error as Error).message;
    expect(message).toContain("401");
    expect(message).not.toContain("gsk-super-secret-key");
  });

  it("respects AI_TIMEOUT_MS and throws AiRequestError on timeout, not leaking the key", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-super-secret-key";
    process.env["AI_TIMEOUT_MS"] = "10";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    );
    const error = await generateStructured({ system: "sys", prompt: "prompt", schema }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AiRequestError);
    const message = (error as Error).message;
    expect(message).toMatch(/timed out/i);
    expect(message).not.toContain("gsk-super-secret-key");
  });

  it("surfaces a network-level failure as AiRequestError without leaking the key", async () => {
    clearAiEnv();
    process.env["GROQ_API_KEY"] = "gsk-super-secret-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("fetch failed: connect ECONNREFUSED for gsk-super-secret-key"),
        ),
    );
    const error = await generateStructured({ system: "sys", prompt: "prompt", schema }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AiRequestError);
    expect((error as Error).message).not.toContain("gsk-super-secret-key");
  });
});
