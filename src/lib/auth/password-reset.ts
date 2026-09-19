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
