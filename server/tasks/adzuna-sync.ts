/**
 * Nitro task, invoked by Cloudflare Cron Triggers via Nitro's native
 * `scheduledTasks` mechanism. This is the PRIMARY automation path:
 * Cloudflare's `scheduled()` Worker event has no public HTTP surface, so
 * nothing external can invoke it -- the platform itself is the security
 * boundary and no user session / admin login / secret is involved.
 *
 * Wiring lives in vite.config.ts and depends on TWO things being true in the
 * built Worker (`npm run verify:cron` checks both):
 *   - `nitro.scheduledTasks[<cron expression>] -> "adzuna-sync"`
 *   - `nitro.tasks["adzuna-sync"].handler -> this file` (an explicit absolute
 *     path; Nitro's auto-scan does NOT find it because Nitro 3 defaults
 *     `serverDir` to false)
 *
 * Does no ingestion logic itself -- delegates entirely to
 * `runAdzunaSyncTask()`, the same function the HTTP cron fallback and the
 * admin "Sync now" button share.
 */
import { defineTask } from "nitro/task";

export default defineTask({
  meta: {
    name: "adzuna-sync",
    description: "Syncs live job postings from Adzuna into the Supabase jobs table.",
  },
  async run() {
    const { supabaseAdmin } = await import("../../src/integrations/supabase/client.server");
    const { runAdzunaSyncTask } = await import("../../src/lib/jobs/adzuna-sync-task.server");
    const summary = await runAdzunaSyncTask(supabaseAdmin, { trigger: "scheduled" });

    // `runAdzunaSyncTask` never throws and records every outcome in
    // `job_sync_runs`. A failed sync is additionally surfaced to Cloudflare as
    // a failed cron invocation (visible in the Worker's logs / observability
    // and alertable) instead of looking like a successful tick. The message
    // was composed by the runner and never contains credentials.
    if (summary.status === "failed") {
      throw new Error(`Scheduled Adzuna sync failed: ${summary.errorMessage ?? "unknown error"}`);
    }
    return { result: summary };
  },
});
