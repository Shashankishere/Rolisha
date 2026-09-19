# Automatic Adzuna job sync

Phase 3.5 makes the existing Adzuna → normalize → classify → Supabase
`jobs` pipeline run on a schedule instead of only when an admin clicks
"Sync now" on `/admin/jobs`. Nothing about the ingestion logic itself
changed — `runAdzunaSyncTask()` (`src/lib/jobs/adzuna-sync-task.server.ts`)
is the one function every trigger (scheduled, manual, HTTP fallback) calls.

## 1. Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ADZUNA_APP_ID` | Yes | Adzuna application id. |
| `ADZUNA_APP_KEY` | Yes (or `ADZUNA_API_KEY`) | Adzuna application key. |
| `ADZUNA_API_KEY` | No | Accepted alias for `ADZUNA_APP_KEY`. |

Without both `ADZUNA_APP_ID` and an app key, every sync attempt (scheduled
or manual) fails safely with a clear "not configured" status — it never
fabricates job data, and the Jobs page falls back to showing whatever
demo/live data already exists in Supabase.

## 2. Scheduler configuration

| Variable | Default | Values |
|---|---|---|
| `ADZUNA_SYNC_SCHEDULE` | `daily` | `daily`, `hourly` |

This is read in `vite.config.ts` **at build time** to choose the Cloudflare
Cron Trigger expression (`0 0 * * *` for daily, `0 * * * *` for hourly) that
gets baked into the generated `wrangler.json`'s `triggers.crons`. **Changing
this value requires a rebuild and redeploy** — Cloudflare Cron Triggers are
deploy-time infrastructure, not something a running Worker can reconfigure
itself. Set the same value in your build environment and your runtime
environment (normally the same CI/CD config provides both) so the schedule
label shown in `/admin/jobs` matches what's actually deployed.

Optional search-scope overrides for the automatic run only (manual syncs
from the admin UI always let you specify these per click regardless):

- `ADZUNA_SYNC_QUERY`
- `ADZUNA_SYNC_LOCATION`
- `ADZUNA_SYNC_COUNTRY` (default: `in`, same as the adapter's own default)
- `ADZUNA_SYNC_MAX_JOBS` (default: `50`; a blank, non-numeric or non-positive
  value falls back to `50` rather than silently fetching 0 or 1 jobs)

### How the scheduling mechanism actually works

This app deploys via Nitro's `cloudflare-module` preset. That preset ships a
native Cloudflare Workers `scheduled()` export already (confirmed by reading
the installed `nitro` package's runtime, not assumed). Configuring
`nitro.experimental.tasks` + `nitro.tasks` + `nitro.scheduledTasks` in
`vite.config.ts` does two things at build time:

1. Registers `server/tasks/adzuna-sync.ts` as a Nitro Task. The handler is
   passed as an **explicit absolute path** in `vite.config.ts`. Do not rely on
   Nitro's directory auto-scan: Nitro 3 defaults `serverDir` to `false`, so
   `server/tasks/*` is never discovered. When that happens the task is still
   registered (so step 2 still happens and everything *looks* configured), but
   its handler is `undefined`, and every cron tick fails with "Task
   `adzuna-sync` is not implemented!" without ever starting a sync. This was
   the cause of the sync never running automatically.
2. Adds the corresponding cron expression to the generated
   `.output/server/wrangler.json`'s `triggers.crons` array.

When deployed, Cloudflare's own infrastructure invokes the Worker's
`scheduled()` handler on that schedule — there is no long-running process,
no `setInterval`, and no public HTTP endpoint for this path at all (Cron
Triggers are not reachable over the internet by anyone, including you). This
is the primary, platform-native mechanism.

### Verifying the cron

Before deploying, check the **built** Worker (not just the config):

```bash
npm run build && npm run verify:cron
```

It checks the cron entry in `wrangler.json`, the `scheduled()` export, **and**
that the task has a resolvable handler. The last check is the one that
matters: a cron entry alone proves nothing. It exits non-zero on any failure.

After deploying, confirm it in production (this cannot be reproduced locally):

1. Cloudflare dashboard → your Worker → Settings → Triggers → **Cron Triggers**
   lists the expression (`0 0 * * *` for the default daily schedule).
2. After the first tick, `job_sync_runs` has a row with `trigger = 'scheduled'`
   and `status = 'success'` (Admin → Job ingestion shows the same history).
3. To see it sooner, temporarily set `ADZUNA_SYNC_SCHEDULE=hourly` and
   redeploy, and/or `wrangler tail` the Worker. A failed sync is also reported
   to Cloudflare as a failed cron invocation, not only as a `failed` row.

If the platform you deploy through builds its own Worker config, confirm that
it uploads `triggers.crons` from the generated `wrangler.json`; that is the one
step outside this repository's control.

### Hourly scheduling

Fully supported — set `ADZUNA_SYNC_SCHEDULE=hourly` before building. Be
mindful of Adzuna's own rate limits if you also run manual syncs frequently;
the adapter's existing pagination/request logic is unchanged and unaffected
by how often the scheduler fires.

## 3. HTTP cron fallback (optional, for local testing or external schedulers)

`POST /api/cron/adzuna-sync` runs the exact same `runAdzunaSyncTask()` as the
native scheduled path, gated by a bearer token checked against
`CRON_SECRET` (existing platform helper,
`src/integrations/supabase/cron-auth.ts`):

```bash
curl -X POST https://your-app.example.com/api/cron/adzuna-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Use this if you'd rather point an external scheduler (GitHub Actions cron,
another host's crontab, a third-party cron service) at this URL instead of
relying solely on the native Cloudflare Cron Trigger, or to test a sync
locally without waiting for a real cron tick. Supports secret rotation via
`CRON_SECRET_PREVIOUS` (old and new secrets both work during
rotation).

Without `CRON_SECRET` set, this endpoint returns `500` and refuses
to run — it does not fail open.

## 4. Testing a sync manually

- **Via the admin UI**: `/admin/jobs` → "Sync now". Works exactly as before,
  now using the same shared runner as the scheduler (so testing here also
  validates your Adzuna credentials for the automatic path).
- **Via the HTTP fallback**: the `curl` command above.
- **Locally, without any real Cloudflare deployment**: run the app locally
  and use either of the above — nothing about the sync logic requires an
  actual Cloudflare Cron Trigger to execute; the Trigger is only what
  invokes it automatically in production.

## 5. Viewing sync status

`/admin/jobs` (admin role required) shows:

- Configured schedule (daily/hourly)
- Latest sync's status (healthy / failed / running), trigger source
  (scheduled / manual / cron_http), and timestamp
- Insert/update/deactivate counts from the latest run
- A "Recent sync history" list of the last 10 runs
- The last error message, if any

This reads from the new `job_sync_runs` table (service-role writes,
admin-only reads).

## 6. What happens when Adzuna fails

Every failure mode (invalid credentials, rate limiting, network errors,
malformed responses, provider outages) results in:

- The failed run recorded in `job_sync_runs` with a real error message
  (never the credential values).
- Zero changes to the existing `jobs` table — nothing deleted, nothing
  replaced with fake data.
- The next scheduled run retries normally.

An empty (zero-result) Adzuna response is treated as a **successful sync
with nothing new to add** — it is never interpreted as "delete everything."

## 7. Stale-job handling

Every job touched by a sync gets `last_seen_at` stamped to the sync time.
After ingesting fresh results, jobs from the same source that haven't been
seen in **14 days** are marked `is_active = false` — never deleted. The Jobs
page only shows `is_active = true` postings by default; a job's detail page
and any user's saved/roadmap references to it remain unaffected by
deactivation.

## 8. Rotating credentials

1. Generate a new Adzuna app key from your Adzuna developer account.
2. Update `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` in your deployment platform's
   environment configuration.
3. Redeploy (env var changes to an already-built Worker still require a
   redeploy to take effect, same as any other Cloudflare Workers env var).
4. Trigger a manual sync from `/admin/jobs` to confirm the new credentials
   work before waiting for the next scheduled run.

To rotate `CRON_SECRET` (only relevant if you're using the HTTP
fallback): set the new value as `CRON_SECRET` and the old value as
`CRON_SECRET_PREVIOUS`, redeploy, update any external caller to use
the new secret, then remove `CRON_SECRET_PREVIOUS` once you're
confident nothing is still using the old one.

## Known limitations

- Changing `ADZUNA_SYNC_SCHEDULE` requires a rebuild + redeploy (see above)
  — it is not a runtime toggle.
- The Nitro Tasks feature this relies on is labeled `@experimental` by
  Nitro itself, though functional in the installed version pinned in
  `package.json`. If a future Nitro upgrade changes this API, the
  scheduled-task wiring in `vite.config.ts` and `server/tasks/adzuna-sync.ts`
  may need updating.
- The dataMode shown on the Jobs page (`demo` / `live` / `mixed`) reflects
  whatever's actually in Supabase at request time — it has no way to know
  whether the *most recent* scheduled sync succeeded without an admin
  checking `/admin/jobs`.
