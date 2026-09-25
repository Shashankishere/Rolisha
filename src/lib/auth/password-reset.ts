import { z } from "zod";

/** Matches the email rule already used on the sign-in/sign-up form
 * (auth.tsx), kept in sync so "forgot password" validates identically. */
export const forgotPasswordEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(255);

/** Matches the password rule already used on sign-up (min 8, Supabase's own
 * 72-byte bcrypt ceiling), plus a confirmation match check for the reset
 * completion screen. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** Whether this user can change a password at all -- i.e. they have an
 * email/password identity linked to their account, as opposed to having
 * signed up exclusively through an OAuth provider like Google. Checks
 * `app_metadata.providers` (all providers ever linked) first since it's
 * always present on a session's user object, falling back to the
 * `identities` array (present on more detailed user fetches) for the same
 * signal. A user who signed up with Google and never set a password should
 * never be shown a "change password" form that assumes one already exists;
 * the product has no "add a password" flow, so a Google-only account simply
 * doesn't get this section rather than being forced into an unsupported
 * one. */
export function hasPasswordAuth(user: {
  app_metadata?: { providers?: string[] | undefined } | null | undefined;
  identities?: { provider: string }[] | null | undefined;
}): boolean {
  if (user.app_metadata?.providers?.includes("email")) return true;
  if (user.identities?.some((identity) => identity.provider === "email")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Change password (Settings > Security) — extracted from the
// ChangePasswordSection component in settings.tsx so the full flow can be
// unit tested directly (this project tests logic this way throughout, e.g.
// updateProfileCore/deleteAccountCore in settings.server.ts), rather than
// only being exercisable by rendering the settings page.
//
// The flow itself is unchanged from the component: Supabase Auth has no
// standalone "verify current password" call, so the current password is
// confirmed by re-authenticating with it (`signInWithPassword`) BEFORE
// `updateUser({ password })` is ever called -- a new password can never be
// set unless that verification step has already succeeded. Neither password
// is ever sent anywhere except directly to Supabase Auth over HTTPS from the
// browser; nothing here introduces a server round trip for either one.
// ---------------------------------------------------------------------------

/** The two Supabase Auth calls this flow needs, factored out as an interface
 * so tests can supply a fake without spinning up a real Supabase client. The
 * real caller passes `supabase.auth` directly, which already satisfies this
 * shape. */
export interface ChangePasswordAuthClient {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ error: { message: string } | null }>;
  updateUser(attributes: {
    password: string;
    currentPassword?: string;
  }): Promise<{ error: { message: string } | null }>;
}

/**
 * Matches Supabase Auth's own "you must reauthenticate before this succeeds"
 * rejection (GoTrue's `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION`
 * project setting -- see the root-cause note on `changePasswordCore` below).
 * GoTrue's own wording for this has read "New password should be different
 * from the old password" is NOT this case; the reauthentication rejection
 * itself has been reported (supabase/auth#1015) as messages containing
 * "reauthenticat" (e.g. "requires reauthentication" / "reauthentication
 * required") -- matched case-insensitively since Supabase does not publish
 * this string as a stable, versioned error code.
 */
function isReauthenticationRequiredError(message: string): boolean {
  return /reauthenticat/i.test(message);
}

export interface ChangePasswordInput {
  /** The signed-in user's email. `null`/empty means the account has no email
   * on file, so the current password can't be re-verified at all. */
  email: string | null;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ChangePasswordResult =
  { ok: true } | { ok: false; message: string; field: "currentPassword" | "newPassword" | "form" };

/**
 * Runs the full change-password flow: field presence -> new-password schema
 * (length + confirmation match) -> re-authenticate with the CURRENT password
 * -> only then update to the new one. Returns a result instead of
 * throwing/toasting directly, so the UI layer decides how to present it and
 * tests can assert on it directly.
 *
 * The three checks are strictly ordered and short-circuit: a missing current
 * password, or an invalid new password, is reported WITHOUT ever calling
 * Supabase (so a network/Supabase-side failure never gets mislabeled as a
 * validation problem, and vice versa) — and, per the required ordering,
 * `updateUser` is only ever reached after `signInWithPassword` has returned
 * successfully.
 *
 * --- Root cause of "Current password required" appearing despite a correct
 * --- current password having been supplied ---
 * This app's own code has never contained that literal string. The actual
 * cause is external to this repository: Supabase Auth (GoTrue) has TWO
 * separate, OPT-IN, project-level security settings, either of which
 * rejects `updateUser({ password })` even after a correct password was
 * already verified client-side via `signInWithPassword`:
 *
 *  1. `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD` -- GoTrue's
 *     `PUT /user` endpoint itself REQUIRES a `current_password` field in the
 *     SAME request body as the new password (supabase/auth PR #2215). This
 *     app's `signInWithPassword` call satisfies nothing here: it's a
 *     separate request GoTrue's server-side check for this setting knows
 *     nothing about. Fixed below by always sending `current_password`
 *     alongside `password` -- harmless if the project setting is off,
 *     required if it's on.
 *  2. `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION` -- requires
 *     a `nonce` (obtained via `supabase.auth.reauthenticate()`, which emails
 *     the user a one-time code) on `updateUser`, for any session older than
 *     24h. This app has no nonce/OTP-entry UI, so it genuinely cannot
 *     satisfy this one without a real feature addition. If this is what's
 *     enabled on the affected Supabase project, `updateUser` is rejected
 *     with a message mentioning reauthentication (supabase/auth#1015); that
 *     specific case is detected below and reported honestly (asking the
 *     user to sign out and back in, which resets their session age) instead
 *     of surfacing GoTrue's raw, confusing error text or silently pretending
 *     the change worked.
 *
 * Both are project-level Auth Settings (or GOTRUE_* env vars on a
 * self-hosted instance) — neither is visible by reading this app's source,
 * which is why this could not be reproduced from source code or a mocked
 * Supabase client alone. If your project has neither setting enabled,
 * neither code path above is ever exercised.
 */
export async function changePasswordCore(
  auth: ChangePasswordAuthClient,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  if (!input.email) {
    return {
      ok: false,
      field: "form",
      message: "Your account has no email on file, so your password can't be verified.",
    };
  }

  // Deliberately NOT trimmed: a password can legitimately contain leading/
  // trailing spaces, and silently stripping them would mean verifying (or
  // setting) a different string than the one the user actually typed. An
  // empty string (nothing typed at all) is the only case treated as missing.
  if (!input.currentPassword) {
    return { ok: false, field: "currentPassword", message: "Enter your current password." };
  }

  const parsed = newPasswordSchema.safeParse({
    password: input.newPassword,
    confirmPassword: input.confirmPassword,
  });
  if (!parsed.success) {
    return {
      ok: false,
      field: "newPassword",
      message: parsed.error.issues[0]?.message ?? "Check your new password.",
    };
  }

  // Verify the CURRENT password by re-authenticating with it before touching
  // anything else -- this is what guarantees a new password can never be set
  // without the current one having been confirmed first. It never signs the
  // user out or drops their existing session; it just confirms the
  // credential and refreshes that same session's tokens (like re-typing your
  // password on the sign-in form).
  const { error: verifyError } = await auth.signInWithPassword({
    email: input.email,
    password: input.currentPassword,
  });
  if (verifyError) {
    return { ok: false, field: "currentPassword", message: "Current password is incorrect." };
  }

  const { error: updateError } = await auth.updateUser({
    password: parsed.data.password,
    // Always sent, not conditionally: satisfies
    // GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD when that
    // project setting is on, and is simply unused by GoTrue when it's off.
    // This is a SECOND, server-side confirmation of the same password
    // already verified above -- it strengthens verification, it does not
    // replace or weaken the `signInWithPassword` check.
    currentPassword: input.currentPassword,
  });
  if (updateError) {
    if (isReauthenticationRequiredError(updateError.message)) {
      return {
        ok: false,
        field: "form",
        message:
          "For your security, please sign out and back in, then try changing your password again.",
      };
    }
    // Propagate Supabase's own message (e.g. "New password should be
    // different from the old password.") rather than a generic one, same as
    // the pre-extraction component behavior.
    return { ok: false, field: "newPassword", message: updateError.message };
  }

  return { ok: true };
}
