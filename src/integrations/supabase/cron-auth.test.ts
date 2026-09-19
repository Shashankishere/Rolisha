import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const ORIGINAL_ENV = { ...process.env };

function request(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://app.example.com/api/cron/adzuna-sync", { method: "POST", headers });
}

beforeEach(() => {
  delete process.env["CRON_SECRET"];
  delete process.env["CRON_SECRET_PREVIOUS"];
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("authenticateCronRequest", () => {
  it("rejects with a server-config error when no secret is set at all", async () => {
    const result = await authenticateCronRequest(request("Bearer anything"));
    expect(result?.status).toBe(500);
  });

  it("rejects an unauthenticated request (401) — nothing runs without a token", async () => {
    process.env["CRON_SECRET"] = "correct-secret";
    const result = await authenticateCronRequest(request());
    expect(result?.status).toBe(401);
  });

  it("rejects a malformed authorization header", async () => {
    process.env["CRON_SECRET"] = "correct-secret";
    const result = await authenticateCronRequest(request("Basic dXNlcjpwYXNz"));
    expect(result?.status).toBe(401);
  });

  it("rejects an incorrect token", async () => {
    process.env["CRON_SECRET"] = "correct-secret";
    const result = await authenticateCronRequest(request("Bearer wrong-secret"));
    expect(result?.status).toBe(401);
  });

  it("authorizes a request bearing the current secret (returns null = proceed)", async () => {
    process.env["CRON_SECRET"] = "correct-secret";
    const result = await authenticateCronRequest(request("Bearer correct-secret"));
    expect(result).toBeNull();
  });

  it("authorizes a request bearing the previous secret (supports rotation without downtime)", async () => {
    process.env["CRON_SECRET"] = "new-secret";
    process.env["CRON_SECRET_PREVIOUS"] = "old-secret";
    const result = await authenticateCronRequest(request("Bearer old-secret"));
    expect(result).toBeNull();
  });
});
