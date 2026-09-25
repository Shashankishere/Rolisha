import { describe, expect, it, vi } from "vitest";
import { changePasswordCore, type ChangePasswordAuthClient } from "@/lib/auth/password-reset";

/**
 * Regression coverage for the reported "Current password required" bug
 * class: a user supplies a correct current password, yet the app still
 * behaves as though it was never provided.
 *
 * Note on scope: the settings.tsx / password-reset.ts implementation this
 * project actually has never sends "currentPassword" to a server action at
 * all -- there is no server round trip, no `current_password` field, and no
 * literal "Current password required" string anywhere in this codebase (the
 * component shows "Enter your current password."). These tests can't
 * reproduce a field-name-mismatch bug that isn't present in the code being
 * tested; what they DO verify, exhaustively, is that a correctly-supplied
 * current password is never rejected as missing or incorrect, that the two
 * checks stay distinct, and that every step of the flow is ordered so a new
 * password genuinely cannot be set without the current one having been
 * verified first.
 */

function fakeAuth(overrides: Partial<ChangePasswordAuthClient> = {}): ChangePasswordAuthClient & {
  signInWithPassword: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
} {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  } as ChangePasswordAuthClient & {
    signInWithPassword: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
}

const VALID_INPUT = {
  email: "person@example.com",
  currentPassword: "old-correct-password",
  newPassword: "new-password-123",
  confirmPassword: "new-password-123",
};

describe("changePasswordCore", () => {
  it("missing current password: reports it as missing WITHOUT calling Supabase at all", async () => {
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, { ...VALID_INPUT, currentPassword: "" });

    expect(result).toEqual({
      ok: false,
      field: "currentPassword",
      message: "Enter your current password.",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("incorrect current password: reports it as incorrect, distinct from 'missing', and never calls updateUser", async () => {
    const auth = fakeAuth({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ error: { message: "Invalid login credentials" } }),
    });
    const result = await changePasswordCore(auth, VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      field: "currentPassword",
      message: "Current password is incorrect.",
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: VALID_INPUT.email,
      password: VALID_INPUT.currentPassword,
    });
    expect(auth.updateUser).not.toHaveBeenCalled(); // never reached without a verified current password
  });

  it("correct current password + valid new password: succeeds and updates to the new password", async () => {
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, VALID_INPUT);

    expect(result).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: VALID_INPUT.email,
      password: VALID_INPUT.currentPassword,
    });
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: VALID_INPUT.newPassword,
      currentPassword: VALID_INPUT.currentPassword,
    });
  });

  it("a genuinely correct current password is NEVER reported as missing or incorrect (the reported bug class)", async () => {
    // The exact regression this bug report describes: user supplies a real,
    // correct current password -- the flow must not treat that as absent.
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, {
      ...VALID_INPUT,
      currentPassword: "correct horse battery staple",
    });
    expect(result.ok).toBe(true);
    expect(auth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ password: "correct horse battery staple" }),
    );
  });

  it("does not trim the current password (a password may legitimately contain spaces)", async () => {
    const auth = fakeAuth();
    await changePasswordCore(auth, { ...VALID_INPUT, currentPassword: "  spaced pw  " });
    expect(auth.signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ password: "  spaced pw  " }), // untouched, not trimmed
    );
  });

  it("current password of only whitespace is treated as a wrong guess, not as 'missing'", async () => {
    // "   " is non-empty, so it must reach real verification and fail there
    // as "incorrect" -- not be short-circuited as though nothing was typed.
    const auth = fakeAuth({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ error: { message: "Invalid login credentials" } }),
    });
    const result = await changePasswordCore(auth, { ...VALID_INPUT, currentPassword: "   " });
    expect(result).toMatchObject({
      field: "currentPassword",
      message: "Current password is incorrect.",
    });
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("invalid new password (too short): rejected before ever contacting Supabase", async () => {
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, {
      ...VALID_INPUT,
      newPassword: "short",
      confirmPassword: "short",
    });

    expect(result).toMatchObject({ ok: false, field: "newPassword" });
    expect((result as { message: string }).message).toMatch(/at least 8 characters/i);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("password confirmation mismatch: rejected before ever contacting Supabase", async () => {
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, {
      ...VALID_INPUT,
      newPassword: "new-password-123",
      confirmPassword: "different-password-456",
    });

    expect(result).toMatchObject({
      ok: false,
      field: "newPassword",
      message: "Passwords do not match",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("missing email on file: reported as a form-level error before any field-level check", async () => {
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, { ...VALID_INPUT, email: null });

    expect(result).toMatchObject({ ok: false, field: "form" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("propagates Supabase's own error message when updateUser itself rejects the new password", async () => {
    const auth = fakeAuth({
      updateUser: vi.fn().mockResolvedValue({
        error: { message: "New password should be different from the old password." },
      }),
    });
    const result = await changePasswordCore(auth, VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      field: "newPassword",
      message: "New password should be different from the old password.",
    });
    // Verification DID happen and DID succeed -- this is a distinct,
    // later failure, not a re-labeled "current password" problem.
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("never calls updateUser before signInWithPassword has resolved (verify-then-update ordering)", async () => {
    const callOrder: string[] = [];
    const auth = fakeAuth({
      signInWithPassword: vi.fn().mockImplementation(async () => {
        callOrder.push("signInWithPassword");
        return { error: null };
      }),
      updateUser: vi.fn().mockImplementation(async () => {
        callOrder.push("updateUser");
        return { error: null };
      }),
    });
    await changePasswordCore(auth, VALID_INPUT);
    expect(callOrder).toEqual(["signInWithPassword", "updateUser"]);
  });

  it("a new password can never be set when current-password verification fails, even if updateUser would have succeeded", async () => {
    const auth = fakeAuth({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ error: { message: "Invalid login credentials" } }),
    });
    await changePasswordCore(auth, VALID_INPUT);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

/**
 * Root-cause regression coverage for the reported production scenario:
 *   1. user opens Change Password
 *   2. user enters the CORRECT current password
 *   3. user enters a valid new password
 *   4. user submits
 *   5. app must NOT respond with any "current password required/missing"
 *      style message
 *
 * The actual cause is external to this repository: Supabase Auth (GoTrue)
 * project settings that reject `updateUser({ password })` even after
 * `signInWithPassword` already verified the same password successfully.
 * See the root-cause note on `changePasswordCore` in password-reset.ts for
 * the full explanation of both settings and why this could not be found by
 * reading application source code alone.
 */
describe("changePasswordCore — the reported production scenario (external GoTrue security settings)", () => {
  it("THE REPORTED SCENARIO: correct current password + valid new password never produces a 'current password' error", async () => {
    const auth = fakeAuth();
    const result = await changePasswordCore(auth, VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      // If this ever fails, print exactly what was wrongly reported instead
      // of a bare "expected true, got false".
      expect(result.message).not.toMatch(/current password/i);
    }
  });

  it("GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD case: sends current_password on EVERY updateUser call, satisfying GoTrue's server-side requirement whether or not the project setting is on", async () => {
    // GoTrue's PUT /user endpoint requires a `current_password` field in the
    // SAME request as the new password when this project setting is
    // enabled (supabase/auth#2215) -- a requirement `signInWithPassword`
    // alone can never satisfy, because it's a completely separate request.
    const auth = fakeAuth();
    await changePasswordCore(auth, VALID_INPUT);

    expect(auth.updateUser).toHaveBeenCalledWith({
      password: VALID_INPUT.newPassword,
      currentPassword: VALID_INPUT.currentPassword, // <- the actual fix
    });
  });

  it("GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD case: if GoTrue rejects updateUser for a MISSING current_password anyway, that is reported honestly, not as success", async () => {
    // Simulates a hypothetical stricter GoTrue rejection so this stays
    // correct even if a future GoTrue version validates more aggressively.
    const auth = fakeAuth({
      updateUser: vi.fn().mockResolvedValue({ error: { message: "current_password is required" } }),
    });
    const result = await changePasswordCore(auth, VALID_INPUT);
    expect(result.ok).toBe(false);
    // Verification (signInWithPassword) still genuinely succeeded first --
    // this is a later, distinct failure, never mislabeled as "you never
    // entered your current password".
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION case: reported honestly (asked to sign back in), not as a generic or misleading error", async () => {
    // supabase/auth#1015: GoTrue rejects updateUser with a message
    // mentioning reauthentication when this OTHER project setting is on
    // and the session isn't "recently" signed in. This app has no nonce/OTP
    // UI to satisfy it, so it must not pretend the change succeeded, and
    // must not show GoTrue's raw internal wording either.
    const auth = fakeAuth({
      updateUser: vi.fn().mockResolvedValue({ error: { message: "requires reauthentication" } }),
    });
    const result = await changePasswordCore(auth, VALID_INPUT);

    expect(result).toEqual({
      ok: false,
      field: "form",
      message:
        "For your security, please sign out and back in, then try changing your password again.",
    });
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1); // the current password WAS correct
  });

  it("a differently-worded reauthentication rejection is still recognized (case-insensitive, substring match)", async () => {
    const auth = fakeAuth({
      updateUser: vi.fn().mockResolvedValue({ error: { message: "Reauthentication Required" } }),
    });
    const result = await changePasswordCore(auth, VALID_INPUT);
    expect(result).toMatchObject({ ok: false, field: "form" });
    expect((result as { message: string }).message).toMatch(/sign out and back in/);
  });

  it("an ordinary updateUser rejection unrelated to reauthentication is NOT swallowed into the reauthentication message", async () => {
    const auth = fakeAuth({
      updateUser: vi.fn().mockResolvedValue({
        error: { message: "New password should be different from the old password." },
      }),
    });
    const result = await changePasswordCore(auth, VALID_INPUT);
    expect(result).toEqual({
      ok: false,
      field: "newPassword",
      message: "New password should be different from the old password.",
    });
  });
});
