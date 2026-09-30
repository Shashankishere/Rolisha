import { describe, expect, it } from "vitest";
import { computeCatalogStats, countSkillsWithLearningContent } from "@/lib/catalog-stats";

const lessons = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}` }));

describe("countSkillsWithLearningContent", () => {
  it("counts a skill once even if several topics teach it", () => {
    expect(
      countSkillsWithLearningContent([
        { skill_id: "a", learning_lessons: lessons(2) },
        { skill_id: "a", learning_lessons: lessons(1) },
        { skill_id: "b", learning_lessons: lessons(3) },
      ]),
    ).toBe(2);
  });

  it("does not count a topic with no lessons -- a stub is not real learning content", () => {
    expect(
      countSkillsWithLearningContent([
        { skill_id: "a", learning_lessons: [] },
        { skill_id: "b", learning_lessons: null },
        { skill_id: "c", learning_lessons: lessons(1) },
      ]),
    ).toBe(1);
  });

  it("is zero for an empty catalogue", () => {
    expect(countSkillsWithLearningContent([])).toBe(0);
  });
});

describe("computeCatalogStats", () => {
  it("maps the three catalogue reads to the three homepage numbers", () => {
    expect(
      computeCatalogStats({
        activeCareerCount: 27,
        skillCount: 79,
        topics: [
          { skill_id: "a", learning_lessons: lessons(2) },
          { skill_id: "b", learning_lessons: lessons(1) },
        ],
      }),
    ).toEqual({ careerPaths: 27, skills: 79, skillsWithLearningContent: 2 });
  });

  it("never reports more learnable skills than skills (partial-read safety)", () => {
    const stats = computeCatalogStats({
      activeCareerCount: 1,
      skillCount: 1,
      topics: [
        { skill_id: "a", learning_lessons: lessons(1) },
        { skill_id: "b", learning_lessons: lessons(1) },
      ],
    });
    expect(stats.skillsWithLearningContent).toBe(1);
  });

  it("treats missing counts as zero rather than inventing a number", () => {
    expect(computeCatalogStats({ activeCareerCount: null, skillCount: null, topics: [] })).toEqual({
      careerPaths: 0,
      skills: 0,
      skillsWithLearningContent: 0,
    });
  });
});
