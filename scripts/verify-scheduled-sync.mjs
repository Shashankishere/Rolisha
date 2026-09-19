#!/usr/bin/env node
/**
 * Post-build check for the automatic Adzuna sync.
 *
 * Usage:  npm run build && npm run verify:cron [-- <server-output-dir>]
 *
 * A Cloudflare Cron Trigger only does anything if ALL of these hold in the
 * BUILT Worker -- not just the first one:
 *   1. wrangler.json has a non-empty `triggers.crons`
 *   2. the Worker entry exports a `scheduled()` handler
 *   3. every scheduled Nitro task has a resolvable handler
 *      (`resolve: () => import(...)`, NOT `resolve: void 0`)
 *   4. the emitted task chunk exists on disk
 *
 * Check 3 is the one that used to be missing: Nitro registers the cron
 * trigger even when it could not find the task's handler file, so the
 * trigger fires on schedule and then fails with "Task ... is not implemented".
 *
 * Exits non-zero on any failure so it can gate a deploy.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const candidates = process.argv[2]
  ? [resolve(process.argv[2])]
  : [resolve(".output/server"), resolve("dist/server")];
const serverDir = candidates.find((dir) => existsSync(join(dir, "wrangler.json")));

const failures = [];
function check(ok, message) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
}

if (!serverDir) {
  console.error(
    `FAIL  No built Worker found. Looked for wrangler.json in: ${candidates.join(", ")}. Run the build first.`,
  );
  process.exit(1);
}
console.log(`Checking built Worker in ${serverDir}\n`);

const wrangler = JSON.parse(readFileSync(join(serverDir, "wrangler.json"), "utf8"));
const crons = wrangler?.triggers?.crons ?? [];
check(crons.length > 0, `wrangler.json declares cron trigger(s): ${JSON.stringify(crons)}`);

const mainFile = join(serverDir, wrangler.main ?? "index.mjs");
const entry = existsSync(mainFile) ? readFileSync(mainFile, "utf8") : "";
check(entry.length > 0, `Worker entry exists (${wrangler.main ?? "index.mjs"})`);
check(/scheduled\s*\(/.test(entry), "Worker entry exports a scheduled() handler");

const scheduled = entry.match(/var scheduledTasks = (\[[\s\S]*?\]);\s*\n\s*var tasks/);
let taskNames = [];
if (scheduled) {
  try {
    taskNames = JSON.parse(scheduled[1].replace(/\n|\t/g, "")).flatMap((t) => t.tasks);
  } catch {
    /* fall through to the explicit failure below */
  }
}
check(taskNames.length > 0, `cron schedule maps to task(s): ${JSON.stringify(taskNames)}`);

for (const name of taskNames) {
  const block = entry.match(new RegExp(`"${name}":\\s*\\{[\\s\\S]*?resolve:\\s*([^\\n]+)`));
  const resolveExpr = block?.[1]?.trim() ?? "";
  const resolvable = /^\(\)\s*=>\s*import\(/.test(resolveExpr);
  check(resolvable, `task "${name}" has a resolvable handler (found: ${resolveExpr || "nothing"})`);
  const chunk = resolveExpr.match(/import\("\.\/([^"]+)"\)/)?.[1];
  if (chunk) check(existsSync(join(serverDir, chunk)), `task chunk ${chunk} was emitted`);
}

if (failures.length > 0) {
  console.error(
    `\n${failures.length} check(s) failed -- the scheduled sync would NOT run in production.`,
  );
  process.exit(1);
}
console.log("\nAll checks passed: the built Worker can run the scheduled sync.");
