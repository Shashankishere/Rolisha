// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// PHASE 3.5 — automatic Adzuna sync schedule.
// Resolved at BUILD time (Cloudflare Cron Triggers are deploy-time
// infrastructure, configured via the generated wrangler.json — there is no
// way to change a Worker's cron schedule at runtime without redeploying).
// Changing ADZUNA_SYNC_SCHEDULE therefore requires a rebuild + redeploy,
// not just an env var change on an already-running Worker.
const ADZUNA_SYNC_SCHEDULE = (process.env["ADZUNA_SYNC_SCHEDULE"] ?? "daily").toLowerCase();
const ADZUNA_SYNC_CRON =
  ADZUNA_SYNC_SCHEDULE === "hourly"
    ? "0 * * * *" // top of every hour
    : "0 0 * * *"; // daily at 00:00 UTC
if (ADZUNA_SYNC_SCHEDULE !== "daily" && ADZUNA_SYNC_SCHEDULE !== "hourly") {
  console.warn(
    `[vite.config] Unknown ADZUNA_SYNC_SCHEDULE "${ADZUNA_SYNC_SCHEDULE}" — falling back to "daily". Supported values: daily, hourly.`,
  );
}

// Absolute path to the Nitro task handler. It is passed EXPLICITLY (see the
// `tasks` block below) instead of relying on Nitro's directory scanner:
// Nitro 3 defaults `serverDir` to `false`, so `scanDirs` is empty and
// `server/tasks/*` is never auto-discovered. When that happens the task is
// still registered -- so `triggers.crons` still appears in wrangler.json --
// but its `resolve` is `undefined`, and every cron tick throws
// "Task `adzuna-sync` is not implemented!" inside `waitUntil()`, silently
// skipping the sync. Checking only for `triggers.crons` therefore proves
// nothing; `npm run verify:cron` checks the built Worker for a resolvable
// handler as well.
const ADZUNA_SYNC_TASK_HANDLER = fileURLToPath(
  new URL("./server/tasks/adzuna-sync.ts", import.meta.url),
);
if (!existsSync(ADZUNA_SYNC_TASK_HANDLER)) {
  // Fail the build loudly rather than ship a cron trigger with no handler.
  throw new Error(
    `[vite.config] Scheduled sync handler not found at ${ADZUNA_SYNC_TASK_HANDLER}. ` +
      "The Adzuna cron trigger would fire with nothing to run.",
  );
}

export default defineConfig({
  // `@lovable.dev/vite-tanstack-config`'s own `nitro` option type only
  // declares `preset`/`output`/`cloudflare` (the fields it explicitly
  // reads before spreading `...userNitroOpts` into the real Nitro plugin
  // config — see its source). `experimental`/`tasks`/`scheduledTasks` are
  // real Nitro config keys the underlying `nitro()` vite plugin
  // understands; the wrapper's TS type just hasn't been updated to
  // list them. `npm run verify:cron` checks the BUILT output: both a
  // `triggers.crons` entry in wrangler.json AND a resolvable task handler.
  nitro: {
    // Nitro Tasks ("experimental" per Nitro's own naming, but a real,
    // shipped feature) is what wires a scheduled function to Cloudflare's
    // native Cron Triggers: when `scheduledTasks` is configured, Nitro's
    // cloudflare-module preset automatically adds the corresponding
    // `triggers.crons` entries to the generated wrangler.json, and its
    // Worker-level `scheduled()` export (already present in the
    // cloudflare-module runtime) invokes the matching task(s). No
    // long-running process, no setInterval — the platform itself invokes
    // this on schedule, and only the platform can (Cloudflare's
    // `scheduled()` event has no public HTTP surface at all).
    experimental: { tasks: true },
    tasks: {
      // `handler` is an explicit ABSOLUTE path -- see ADZUNA_SYNC_TASK_HANDLER above
      // for why relying on auto-scan does not work in this project.
      "adzuna-sync": {
        handler: ADZUNA_SYNC_TASK_HANDLER,
        description: "Syncs live job postings from Adzuna into the Supabase jobs table.",
      },
    },
    scheduledTasks: {
      [ADZUNA_SYNC_CRON]: "adzuna-sync",
    },
    // These are valid Nitro options the wrapper's narrower TS type doesn't
    // declare (see the comment at the top of this `nitro` block).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          // The default build produced one ~570KB client entry chunk
          // (everything not already split per-route by TanStack Router's
          // file-based lazy routes) because large, rarely-co-loaded
          // vendor libraries were all bundled together with app code.
          // Splitting them into their own cacheable chunks means a user
          // navigating between pages re-downloads app code but not
          // React/Router/Supabase/Radix again, and a browser that already
          // cached these from a previous deploy skips them entirely on
          // the next one (they only change when the dependency itself
          // is upgraded).
          // This build runs on Rolldown (Vite 8), which requires
          // manualChunks as a function rather than Rollup's classic
          // string-array-map object form.
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
              if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query"))
                return "vendor-router";
              if (id.includes("@supabase/supabase-js")) return "vendor-supabase";
              if (id.includes("@radix-ui")) return "vendor-radix";
            }
            return undefined;
          },
        },
      },
    },
  },
});
