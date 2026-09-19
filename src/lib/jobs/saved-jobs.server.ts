/**
 * Save/unsave a job for the current user.
 *
 * Extracted out of `jobs.functions.ts` (where the logic previously lived
 * inline in the two `createServerFn` handlers) so it can be unit tested the
 * same way as `listJobsCore` and `addMissingSkillsToRoadmap` — the handlers
 * in `jobs.functions.ts` now just call these. Behavior is unchanged: both
 * operations are scoped by `userId`, which always comes from the
 * authenticated server context (`context.userId` from `requireSupabaseAuth`),
 * never from client-supplied input — see `jobs.functions.ts` and
 * `auth-middleware.ts`. `saved_jobs` RLS (`auth.uid() = user_id`) is a second,
 * independent enforcement layer at the database level.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/** Idempotent: saving an already-saved job is a no-op upsert, not an error. */
export async function saveJobCore(
  supabase: Client,
  userId: string,
  jobId: string,
): Promise<{ ok: true }> {
  const { error } = await supabase
    .from("saved_jobs")
    .upsert({ user_id: userId, job_id: jobId }, { onConflict: "user_id,job_id" });
  if (error) throw new Error("Unable to save this job.");
  return { ok: true };
}

/** Idempotent: unsaving a job that isn't saved deletes zero rows, not an error. */
export async function unsaveJobCore(
  supabase: Client,
  userId: string,
  jobId: string,
): Promise<{ ok: true }> {
  const { error } = await supabase
    .from("saved_jobs")
    .delete()
    .eq("user_id", userId)
    .eq("job_id", jobId);
  if (error) throw new Error("Unable to unsave this job.");
  return { ok: true };
}
