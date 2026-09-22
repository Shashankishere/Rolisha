/**
 * Data-integrity regression guard (ticket: "some career roadmaps have
 * little or no learning content").
 *
 * `roadmap-career-coverage.test.ts` proves the *roadmap generation
 * algorithm* never produces empty weeks — but `buildRoadmap` only needs a
 * skill's slug/name, so that test would pass even if a skill had zero rows
 * in `learning_topics`. It does not catch a missing career↔skill↔content
 * link.
 *
 * This test catches that specific link. It has no live Supabase
 * credentials available (none are configured in this environment, and the
 * sandbox network policy doesn't reach *.supabase.co either), so it can't
 * query production directly. Instead it parses the actual SQL the app
 * ships to production — the migrations under `supabase/migrations` — at
 * test time. That's the same data that becomes the production database the
 * moment migrations are applied, so a gap here is a real seed-data gap, not
 * a hypothetical one.
 *
 * Crucially this is NOT hardcoded to today's careers: it discovers every
 * `career_skills` row from the SQL itself, so a future migration that adds
 * a 28th career or a new skill to an existing one is covered automatically
 * — if someone forgets to also add a `learning_topics` row for a new
 * skill, this test fails loudly instead of shipping a silently-empty week.
 *
 * If/when this project wires up a real Supabase service-role connection for
 * CI, this same assertion should additionally be run against a live query
 * of `career_skills` / `skills` / `learning_topics` — parsing migration SQL
 * is a strong proxy for "what will be seeded" but doesn't prove production
 * actually has every migration applied. See the root-cause report for that
 * caveat.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "../../supabase/migrations");

function readMigrations(): { file: string; text: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(MIGRATIONS_DIR, file), "utf-8") }));
}

/** (careerSlug, skillSlug) pairs from every `career_skills` seed INSERT. */
function extractCareerSkills(migrations: { file: string; text: string }[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const { text } of migrations) {
    for (const m of text.matchAll(
      /INSERT INTO (?:public\.)?career_skills[^;]*?FROM \(VALUES(.*?)\)\s*(?:v|AS v)/gis,
    )) {
      const block = m[1]!;
      for (const t of block.matchAll(
        /\(\s*'([a-z0-9-]+)'\s*,\s*'([a-z0-9-]+)'\s*,\s*'[a-z_]+'\s*,\s*'[a-z_]+'\s*,\s*\d+\s*,\s*\d+\s*\)/g,
      )) {
        pairs.push([t[1]!, t[2]!]);
      }
    }
  }
  return pairs;
}

/** Every skill slug that has at least one `learning_topics` row. */
function extractSkillsWithLearningContent(
  migrations: { file: string; text: string }[],
): Set<string> {
  const slugs = new Set<string>();
  for (const { text } of migrations) {
    // `learning_topics` seed blocks always alias their VALUES rows as
    // `v(slug, skill_slug, ...)` with skill_slug second — see any of the
    // 20260826*/20260901*/20260906* seed migrations for the pattern this
    // matches against.
    for (const m of text.matchAll(/FROM \(VALUES(.*?)\) AS v\(slug, skill_slug/gs)) {
      const block = m[1]!;
      for (const t of block.matchAll(/\(\s*'([a-z0-9-]+)'\s*,\s*'([a-z0-9-]+)'/g)) {
        slugs.add(t[2]!);
      }
    }
  }
  return slugs;
}

describe("career -> skill -> learning_topics coverage (real seed migrations)", () => {
  const migrations = readMigrations();
  const careerSkillPairs = extractCareerSkills(migrations);
  const skillsWithContent = extractSkillsWithLearningContent(migrations);

  it("parsed a non-trivial number of career_skills rows (sanity check on the parser itself)", () => {
    // If this regresses to 0, the parser broke (e.g. a migration authoring
    // style changed) — that's a test-infra problem, not a real "0 careers"
    // situation, but it would make every assertion below vacuously true, so
    // guard against silently-passing-for-the-wrong-reason.
    expect(careerSkillPairs.length).toBeGreaterThan(200);
  });

  it("parsed a non-trivial number of skills-with-content (sanity check on the parser itself)", () => {
    expect(skillsWithContent.size).toBeGreaterThan(40);
  });

  const byCareer = new Map<string, Set<string>>();
  for (const [career, skill] of careerSkillPairs) {
    if (!byCareer.has(career)) byCareer.set(career, new Set());
    byCareer.get(career)!.add(skill);
  }

  it("discovered all 27 currently-supported careers from the seed SQL", () => {
    // Not hardcoded — this is whatever the migrations actually define.
    // Update this number only when careers are intentionally added/removed.
    expect(byCareer.size).toBe(27);
  });

  for (const [career, skills] of [...byCareer.entries()].sort()) {
    it(`${career}: every required skill has at least one learning_topics row`, () => {
      const missing = [...skills].filter((s) => !skillsWithContent.has(s)).sort();
      expect(missing).toEqual([]);
    });
  }
});
