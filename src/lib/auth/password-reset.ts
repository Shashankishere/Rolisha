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
  updateUser(attributes: { password: string }): Promise<{ error: { message: string } | null }>;
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

  const { error: updateError } = await auth.updateUser({ password: parsed.data.password });
  if (updateError) {
    // Propagate Supabase's own message (e.g. "New password should be
    // different from the old password.") rather than a generic one, same as
    // the pre-extraction component behavior.
    return { ok: false, field: "newPassword", message: updateError.message };
  }

  return { ok: true };
}
