/**
 * Homepage catalogue statistics -- the single definition of what each
 * number means. Pure (no I/O) so the definitions are unit-testable and safe
 * to import from client code; the query that feeds it lives in
 * `catalog.functions.ts` (`getCatalogStats`).
 *
 * Definitions:
 *   careerPaths                 active rows in `careers` (inactive/legacy
 *                               careers are excluded; slug is UNIQUE, so
 *                               there is nothing to de-duplicate).
 *   skills                      rows in `skills` (slug is UNIQUE).
 *   skillsWithLearningContent   DISTINCT skills that have at least one
 *                               `learning_topics` row which itself has at
 *                               least one `learning_lessons` row. A skill
 *                               whose topic has no lessons is a stub, not
 *                               learning content, and is not counted.
 */

export interface CatalogStats {
  careerPaths: number;
  skills: number;
  skillsWithLearningContent: number;
}

export interface LearningTopicWithLessons {
  skill_id: string;
  learning_lessons: { id: string }[] | null;
}

export function countSkillsWithLearningContent(topics: LearningTopicWithLessons[]): number {
  const skillIds = new Set<string>();
  for (const topic of topics) {
    if ((topic.learning_lessons?.length ?? 0) > 0) skillIds.add(topic.skill_id);
  }
  return skillIds.size;
}

export function computeCatalogStats(input: {
  activeCareerCount: number | null;
  skillCount: number | null;
  topics: LearningTopicWithLessons[];
}): CatalogStats {
  const skills = input.skillCount ?? 0;
  return {
    careerPaths: input.activeCareerCount ?? 0,
    skills,
    // A learning topic can only reference an existing skill (FK), so this can
    // never legitimately exceed the skill count; clamp defensively so a
    // partial read can't render "more learnable skills than skills".
    skillsWithLearningContent: Math.min(countSkillsWithLearningContent(input.topics), skills),
  };
}
