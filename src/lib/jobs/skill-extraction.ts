/**
 * MVP skill extraction.
 *
 * Deterministic keyword/alias matching against the existing `skills` catalog
 * (name + aliases). No AI, no network calls, no invented skills — this only
 * ever returns skill IDs that already exist in the `skills` table.
 *
 * This is intentionally simple: it is a first pass at "does this job text
 * mention this skill", not a semantic understanding of the posting. It will
 * miss paraphrased requirements and can still be fooled by unusual phrasing.
 */

export interface SkillCatalogEntry {
  id: string;
  name: string;
  aliases: string[];
}

export interface ExtractedSkill {
  skillId: string;
  /** The exact alias/name text that triggered the match, for auditing (stored in job_skills.raw_text). */
  matchedText: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a whole-word/whole-phrase regex for a candidate pattern. Uses
 * lookaround instead of `\b` so multi-word and hyphenated patterns (e.g.
 * "power bi", "t-sql") aren't matched as a bare substring of a longer word
 * (e.g. matching bare "sql" inside "PostgreSQL" is intentionally rejected —
 * "PostgreSQL" only matches the `postgresql`/`postgres` patterns).
 */
function buildPatternRegex(pattern: string): RegExp | null {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return null;
  const escaped = escapeRegExp(normalized).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

/**
 * Extracts skill IDs that appear to be required by a job, based on its title
 * and description. Returns at most one match per skill (deduplicated), even
 * if several aliases for the same skill appear in the text.
 */
export function extractSkills(
  jobTitle: string,
  jobDescription: string | null,
  skillsCatalog: SkillCatalogEntry[],
): ExtractedSkill[] {
  const text = `${jobTitle}\n${jobDescription ?? ""}`;
  const found = new Map<string, ExtractedSkill>();

  for (const skill of skillsCatalog) {
    if (found.has(skill.id)) continue;
    const candidates = [skill.name, ...skill.aliases];
    for (const candidate of candidates) {
      const regex = buildPatternRegex(candidate);
      if (!regex) continue;
      if (regex.test(text)) {
        found.set(skill.id, { skillId: skill.id, matchedText: candidate });
        break;
      }
    }
  }

  return [...found.values()];
}

/** Convenience: just the deduplicated skill IDs, in catalog order. */
export function extractSkillIds(
  jobTitle: string,
  jobDescription: string | null,
  skillsCatalog: SkillCatalogEntry[],
): string[] {
  return extractSkills(jobTitle, jobDescription, skillsCatalog).map((s) => s.skillId);
}
