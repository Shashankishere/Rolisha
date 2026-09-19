/**
 * Deterministic career classification.
 *
 * Given a normalized job posting (title, description, and the skill IDs
 * already extracted by `extractSkills()`) and a bulk-loaded snapshot of the
 * careers catalogue, decides which single career — if any — this posting
 * most plausibly belongs to.
 *
 * Explicitly NOT an LLM and NOT a network call: this is pure token/ID-set
 * overlap scoring, synchronous and deterministic, so the same input always
 * produces the same output and it can be unit tested without a database.
 *
 * Design goal: it is always safer to leave `career_id` NULL than to guess
 * wrong. A career is only assigned when the top match clears an absolute
 * confidence floor AND is unambiguously ahead of the runner-up — otherwise
 * this returns `careerId: null` and the caller stores NULL, same as today.
 */

/** One career from the catalogue, pre-joined with its `career_skills`. */
export interface CareerCatalogEntry {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  /** Skill IDs linked to this career via `career_skills` (any importance). */
  skillIds: string[];
}

export interface ClassifyCareerInput {
  title: string;
  description: string | null;
  /** Skill IDs already extracted from this posting by `extractSkills()`. */
  extractedSkillIds: string[];
}

export interface CareerScore {
  careerId: string;
  /** Combined weighted score in [0, 1]. Not persisted — for tests/debugging only. */
  score: number;
}

export interface CareerClassificationResult {
  careerId: string | null;
  /** Confidence in the winning career, in [0, 1]. 0 when careerId is null. */
  confidence: number;
  /** Every career's score, highest first. Never persisted — explainability aid. */
  scores: CareerScore[];
}

// Generic words that would otherwise create noisy overlap between unrelated
// job titles/descriptions (e.g. every posting says "team" and "experience").
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "role",
  "team",
  "the",
  "to",
  "with",
  "you",
  "your",
  "we",
  "will",
  "work",
  "working",
  "job",
  "position",
  "opportunity",
  "experience",
  "years",
  "year",
  "strong",
  "excellent",
  "looking",
  "join",
  "about",
  "using",
  "across",
  "within",
  "including",
  "etc",
  "new",
  "must",
  "such",
  "who",
  "this",
  "that",
  "can",
  "skills",
  "skill",
  "required",
  "requirements",
  "responsibilities",
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/** Overlap relative to the smaller token set — generous but bounded to [0, 1]. */
function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits / Math.min(a.size, b.size);
}

/** Jaccard similarity between two skill-ID sets. */
function skillOverlap(extractedSkillIds: string[], careerSkillIds: string[]): number {
  if (extractedSkillIds.length === 0 || careerSkillIds.length === 0) return 0;
  const a = new Set(extractedSkillIds);
  const b = new Set(careerSkillIds);
  let hits = 0;
  for (const id of a) if (b.has(id)) hits += 1;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize === 0 ? 0 : hits / unionSize;
}

// Skills are the most reliable signal (both sides are already normalized IDs
// from the same catalogue), title next, free-text description last since it
// is the noisiest of the three.
const WEIGHT_SKILLS = 0.45;
const WEIGHT_TITLE = 0.4;
const WEIGHT_DESCRIPTION = 0.15;

// Conservative thresholds, tuned so an unrelated posting scores well below
// these rather than to maximize recall — a wrong career_id is worse than a
// missing one.
const MIN_ABSOLUTE_SCORE = 0.18;
const MIN_LEAD_OVER_RUNNER_UP = 0.08;

/**
 * Classifies one normalized posting against the full careers catalogue.
 * Pure and synchronous: does not touch the network or the database. Callers
 * are responsible for loading `catalog` in bulk (see `loadCareerCatalog` in
 * `ingest.server.ts`) so this can be called once per job without N+1 queries.
 */
export function classifyCareer(
  input: ClassifyCareerInput,
  catalog: CareerCatalogEntry[],
): CareerClassificationResult {
  const titleTokens = tokenize(input.title);
  const descriptionTokens = tokenize(input.description ?? "");

  const scores: CareerScore[] = catalog
    .map((career) => {
      const careerTitleTokens = tokenize(career.title);
      const careerTextTokens = tokenize(
        `${career.shortDescription ?? ""} ${career.description ?? ""}`,
      );

      const titleScore = overlapRatio(titleTokens, careerTitleTokens);
      const descriptionScore = overlapRatio(descriptionTokens, careerTextTokens);
      const skillScore = skillOverlap(input.extractedSkillIds, career.skillIds);

      const score =
        titleScore * WEIGHT_TITLE +
        descriptionScore * WEIGHT_DESCRIPTION +
        skillScore * WEIGHT_SKILLS;

      return { careerId: career.id, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scores[0];
  const runnerUp = scores[1];

  if (!top || top.score < MIN_ABSOLUTE_SCORE) {
    return { careerId: null, confidence: 0, scores };
  }
  if (runnerUp && top.score - runnerUp.score < MIN_LEAD_OVER_RUNNER_UP) {
    // Too close to call — leave it to a human rather than guess.
    return { careerId: null, confidence: top.score, scores };
  }

  return { careerId: top.careerId, confidence: top.score, scores };
}
