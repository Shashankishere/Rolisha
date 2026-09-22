/**
 * Server-side core logic for the Settings page.
 *
 * Deliberately separate from `completeOnboarding` (me.functions.ts): that
 * handler also rewrites `user_skills` and regenerates the active roadmap as
 * a side effect, which is correct for onboarding but wrong for "I just want
 * to change my target salary." `updateProfileCore` only ever touches the
 * profile fields a settings form would show, and never touches
 * career_id/education/skills or triggers a roadmap rebuild.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export interface ProfileUpdateInput {
  fullName?: string | null | undefined;
  targetRole?: string | undefined;
  hoursPerWeek?: number | undefined;
  salaryTarget?: number | null | undefined;
  country?: string | null | undefined;
  city?: string | null | undefined;
  workMode?: "remote" | "hybrid" | "onsite" | "any" | undefined;
}

export async function updateProfileCore(
  supabase: Client,
  userId: string,
  input: ProfileUpdateInput,
): Promise<{ ok: true }> {
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch["full_name"] = input.fullName || null;
  if (input.targetRole !== undefined) patch["target_role"] = input.targetRole;
  if (input.hoursPerWeek !== undefined) patch["hours_per_week"] = input.hoursPerWeek;
  if (input.salaryTarget !== undefined) patch["salary_target"] = input.salaryTarget;
  if (input.country !== undefined) patch["country"] = input.country || null;
  if (input.city !== undefined) patch["city"] = input.city || null;
  if (input.workMode !== undefined) patch["work_mode"] = input.workMode;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error("Unable to save your settings.");
  return { ok: true };
}

/**
 * Every top-level table keyed by user_id (or, for `profiles`, by id) that
 * isn't already covered by an ON DELETE CASCADE from another user-owned
 * table. `roadmap_months`/`roadmap_tasks` cascade from `roadmaps` and are
 * intentionally NOT listed here.
 *
 * MAINTENANCE NOTE: there is no FK from these tables to `auth.users`, so
 * nothing cascades automatically when the auth user is deleted. Any new
 * user-owned table must be added to this list, or account deletion will
 * silently leave orphaned rows behind.
 */
const USER_OWNED_TABLES = [
  "user_roles",
  "user_skills",
  "roadmaps",
  "user_projects",
  "assessment_attempts",
  "applications",
  "progress_events",
  "notifications",
  "saved_jobs",
  "job_matches",
] as const;

/**
 * Permanently deletes a user's account: every row they own, then the
 * `profiles` row, then the underlying Supabase auth user. Must be called
 * with the service-role client (see client.server.ts) — deleting the auth
 * user itself requires `auth.admin`, which the RLS-scoped client can't do.
 * Irreversible; the caller (deleteAccount server fn) is responsible for
 * confirming the request actually came from the account owner before
 * invoking this.
 */
export async function deleteAccountCore(
  supabaseAdmin: Client,
  userId: string,
): Promise<{ ok: true }> {
  for (const table of USER_OWNED_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Unable to delete account data (${table}).`);
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileError) throw new Error("Unable to delete your profile.");

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) throw new Error("Unable to delete your account.");

  return { ok: true };
}
