import { describe, expect, it, vi } from "vitest";
import { requireAdmin, AdminAccessError } from "@/lib/jobs/require-admin.server";
import { parseAdminAccessError } from "@/lib/jobs/admin-access-error";
import { createFakeSupabase } from "./__tests__/fake-supabase";
import { USER_A, USER_B } from "./__tests__/fixtures";

describe("requireAdmin", () => {
  it("resolves silently when the user has the admin role", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    await expect(requireAdmin(fake, USER_A)).resolves.toBeUndefined();
  });

  it("throws Forbidden when the user has no admin role row", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(requireAdmin(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("throws Forbidden when the user has no role rows at all", async () => {
    const fake = createFakeSupabase();
    await expect(requireAdmin(fake, USER_A)).rejects.toThrow(/forbidden/i);
  });

  it("does not grant access to a different user's admin role", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    await expect(requireAdmin(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  // --- Regression test: a user with BOTH 'user' and 'admin' rows -----------
  // This is the exact scenario reported: public.user_roles legitimately
  // contains a row with role='user' AND a separate row with role='admin'
  // for the same user_id (the signup trigger grants 'user' by default;
  // 'admin' is granted independently). The admin check must succeed here —
  // the extra 'user' row must never interfere with the admin check, in
  // either order and regardless of how many other non-admin role rows exist.
  it("correctly authorizes a user who has BOTH 'user' and 'admin' roles", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [
      { user_id: USER_A, role: "user" },
      { user_id: USER_A, role: "admin" },
    ]);
    await expect(requireAdmin(fake, USER_A)).resolves.toBeUndefined();
  });

  it("still authorizes correctly when the admin row is seeded before the user row", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [
      { user_id: USER_A, role: "admin" },
      { user_id: USER_A, role: "user" },
    ]);
    await expect(requireAdmin(fake, USER_A)).resolves.toBeUndefined();
  });

  it("authorizes correctly even with additional non-admin roles present (user + moderator + admin)", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [
      { user_id: USER_A, role: "user" },
      { user_id: USER_A, role: "moderator" },
      { user_id: USER_A, role: "admin" },
    ]);
    await expect(requireAdmin(fake, USER_A)).resolves.toBeUndefined();
  });

  // --- Error differentiation: "not an admin" vs "the check itself failed" -
  it("throws a distinct AdminAccessError('verification_failed') when the query itself fails, not 'Forbidden'", async () => {
    // A minimal fake client whose user_roles query fails with a real DB
    // error, distinct from FakeSupabase (which can never return an error).
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: "connection reset" } }),
          }),
        }),
      }),
    };

    const errorLogSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(requireAdmin(failingClient, USER_A)).rejects.toThrow(AdminAccessError);
      const thrown = await requireAdmin(failingClient, USER_A).catch((e: unknown) => e);
      const parsed = parseAdminAccessError(thrown);
      expect(parsed?.code).toBe("verification_failed");
      expect(parsed?.message).not.toMatch(/forbidden/i);
      // The raw DB error text must never leak into the user-facing message.
      expect(parsed?.message).not.toContain("connection reset");
    } finally {
      errorLogSpy.mockRestore();
    }
  });

  it("parseAdminAccessError distinguishes not_admin from verification_failed and returns null for unrelated errors", async () => {
    const fake = createFakeSupabase();
    const notAdminError = await requireAdmin(fake, USER_A).catch((e: unknown) => e);
    expect(parseAdminAccessError(notAdminError)?.code).toBe("not_admin");

    expect(parseAdminAccessError(new Error("some unrelated bug"))).toBeNull();
    expect(parseAdminAccessError("not even an Error")).toBeNull();
  });
});
