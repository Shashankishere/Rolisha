/**
 * Career-coverage regression tests (ticket: "many careers have no actual
 * learning content").
 *
 * The `career_skills` rows below are copied verbatim (slug, importance,
 * required_level, demand_percentage, sort_order) from the real seed
 * migrations -- 20260822065725_c8076282-7e0a-4dfd-be96-9ad6074106dc.sql and
 * 20260906010000_expand_careers_and_skills.sql -- not invented data. These
 * are 8 of the app's 27 real, currently-supported careers, chosen to span
 * every category mentioned in the ticket: software development, data
 * science, AI/ML, cybersecurity, cloud/DevOps, UI/UX, product, and QA.
 *
 * `buildRoadmap` only needs `skillId`/`name`/`importance`/`requiredLevel`,
 * not a live database, so this exercises the real generation logic against
 * real career shape without needing a live Supabase instance.
 */
import { describe, expect, it } from "vitest";
import {
  buildRoadmap,
  findWeeklyCapacityViolations,
  type SkillLearningContent,
} from "@/lib/roadmap.server";
import { buildSkillGaps, type ProficiencyLevel, type RequiredSkill } from "@/lib/domain";

interface RealCareer {
  slug: string;
  title: string;
  category: string;
  skills: [string, RequiredSkill["importance"], ProficiencyLevel, number, number][];
}

// [skillSlug, importance, requiredLevel, demandPercentage, sortOrder]
const REAL_CAREERS: RealCareer[] = [
  {
    slug: "software-engineer",
    title: "Software Engineer",
    category: "Software development",
    skills: [
      ["python", "high", "advanced", 62, 1],
      ["javascript", "high", "advanced", 66, 2],
      ["git", "critical", "advanced", 81, 3],
      ["system-design", "high", "intermediate", 47, 4],
      ["api-design", "high", "advanced", 59, 5],
      ["testing", "high", "intermediate", 52, 6],
      ["postgresql", "medium", "intermediate", 44, 7],
      ["docker", "medium", "intermediate", 41, 8],
      ["ci-cd", "medium", "intermediate", 38, 9],
      ["cloud-aws", "medium", "beginner", 43, 10],
      ["java", "medium", "intermediate", 35, 11],
      ["problem-solving", "high", "advanced", 49, 12],
    ],
  },
  {
    slug: "data-scientist",
    title: "Data Scientist",
    category: "Data / analytics",
    skills: [
      ["python", "critical", "advanced", 86, 1],
      ["statistics", "critical", "advanced", 78, 2],
      ["machine-learning", "critical", "advanced", 74, 3],
      ["pandas", "high", "advanced", 61, 4],
      ["sql", "high", "intermediate", 66, 5],
      ["data-visualization", "high", "intermediate", 49, 6],
      ["deep-learning", "medium", "intermediate", 38, 7],
      ["r-language", "nice_to_have", "beginner", 21, 8],
      ["communication", "high", "intermediate", 42, 9],
    ],
  },
  {
    slug: "ai-engineer",
    title: "AI Engineer",
    category: "AI / ML",
    skills: [
      ["python", "critical", "advanced", 78, 1],
      ["llms", "critical", "advanced", 65, 2],
      ["generative-ai", "high", "advanced", 60, 3],
      ["rag", "high", "intermediate", 52, 4],
      ["prompt-engineering", "high", "intermediate", 48, 5],
      ["machine-learning", "high", "advanced", 55, 6],
      ["nlp", "medium", "intermediate", 40, 7],
      ["api-design", "medium", "intermediate", 42, 8],
      ["mlops", "medium", "intermediate", 38, 9],
      ["cloud-aws", "medium", "beginner", 34, 10],
    ],
  },
  {
    slug: "cybersecurity-analyst",
    title: "Cybersecurity Analyst",
    category: "Cybersecurity",
    skills: [
      ["networking", "critical", "advanced", 79, 1],
      ["linux", "high", "intermediate", 58, 2],
      ["siem", "high", "intermediate", 54, 3],
      ["incident-response", "critical", "intermediate", 62, 4],
      ["network-security", "high", "advanced", 67, 5],
      ["ethical-hacking", "medium", "beginner", 35, 6],
      ["security-frameworks", "medium", "intermediate", 44, 7],
      ["python", "medium", "beginner", 31, 8],
    ],
  },
  {
    slug: "devops-engineer",
    title: "DevOps Engineer",
    category: "Cloud / DevOps",
    skills: [
      ["linux", "critical", "advanced", 70, 1],
      ["docker", "critical", "advanced", 72, 2],
      ["ci-cd", "critical", "advanced", 68, 3],
      ["kubernetes", "high", "advanced", 60, 4],
      ["terraform", "high", "intermediate", 55, 5],
      ["cloud-aws", "high", "advanced", 58, 6],
      ["infrastructure-as-code", "high", "intermediate", 50, 7],
      ["monitoring-observability", "high", "intermediate", 46, 8],
      ["networking", "medium", "intermediate", 38, 9],
      ["git", "high", "advanced", 55, 10],
    ],
  },
  {
    slug: "ui-ux-designer",
    title: "UI/UX Designer",
    category: "UI/UX",
    skills: [
      ["figma", "critical", "advanced", 82, 1],
      ["ui-design", "critical", "advanced", 76, 2],
      ["ux-design", "critical", "advanced", 74, 3],
      ["user-research", "high", "intermediate", 57, 4],
      ["prototyping", "high", "advanced", 63, 5],
      ["design-systems", "high", "intermediate", 48, 6],
      ["accessibility", "medium", "intermediate", 36, 7],
      ["html-css", "nice_to_have", "beginner", 24, 8],
    ],
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    category: "Product / business",
    skills: [
      ["product-strategy", "critical", "advanced", 72, 1],
      ["roadmapping", "high", "advanced", 65, 2],
      ["user-research", "high", "intermediate", 53, 3],
      ["product-analytics", "high", "intermediate", 58, 4],
      ["agile", "high", "advanced", 61, 5],
      ["stakeholder-management", "critical", "advanced", 69, 6],
      ["sql", "medium", "beginner", 34, 7],
      ["communication", "critical", "advanced", 77, 8],
    ],
  },
  {
    slug: "qa-engineer",
    title: "QA Engineer",
    category: "QA / other",
    skills: [
      ["testing", "critical", "advanced", 70, 1],
      ["test-automation", "high", "advanced", 58, 2],
      ["problem-solving", "high", "advanced", 42, 3],
      ["git", "high", "intermediate", 45, 4],
      ["sql", "medium", "intermediate", 40, 5],
      ["api-design", "medium", "intermediate", 38, 6],
      ["communication", "medium", "intermediate", 32, 7],
    ],
  },
];

function toRequiredSkills(career: RealCareer): RequiredSkill[] {
  return career.skills
    .sort((a, b) => a[4] - b[4])
    .map(([slug, importance, requiredLevel, demand]) => ({
      skillId: slug,
      name: slug,
      importance,
      requiredLevel,
      demandPercentage: demand,
    }));
}

describe("real career coverage (ticket: careers with no learning content)", () => {
  for (const career of REAL_CAREERS) {
    describe(`${career.title} (${career.category}, slug: ${career.slug})`, () => {
      it.each([1, 2, 4, 6, 10, 24])(
        "at %i hours/week: 6 months exist, each has meaningful tasks, no week exceeds capacity",
        (hoursPerWeek) => {
          const required = toRequiredSkills(career);
          // Complete beginner: every required skill is a real gap, the
          // hardest case for "does this career have enough content".
          const gaps = buildSkillGaps(required, {});
          const months = buildRoadmap({ role: career.title, gaps, hoursPerWeek });

          expect(months).toHaveLength(6);
          expect(findWeeklyCapacityViolations(months, hoursPerWeek)).toEqual([]);
          for (const month of months) {
            expect(month.tasks.length).toBeGreaterThan(0);
            expect(month.estimatedHours).toBeGreaterThan(0);
            for (const task of month.tasks) {
              expect(task.estimatedHours).toBeGreaterThan(0);
            }
          }
        },
      );

      it("respects existing skills: a user already strong in every required skill still gets 6 meaningful months, not empty ones", () => {
        const required = toRequiredSkills(career);
        const levels: Record<string, ProficiencyLevel> = {};
        for (const skill of required) levels[skill.skillId] = "expert";
        const gaps = buildSkillGaps(required, levels);

        const months = buildRoadmap({ role: career.title, gaps, hoursPerWeek: 6 });
        expect(months).toHaveLength(6);
        for (const month of months) {
          expect(month.tasks.length).toBeGreaterThan(0);
        }
        expect(findWeeklyCapacityViolations(months, 6)).toEqual([]);
        // The final month still pushes toward applying, even for someone
        // who already knows everything the career requires.
        expect(months[5]!.tasks.some((t) => t.title.includes("Send applications"))).toBe(true);
      });
    });
  }
});

describe(
  "content-heavy weeks never exceed the weekly cap (ticket regression: production " +
    "roadmaps showing 7h/8h weeks under a 6h/week budget -- e.g. a 'Cloud (AWS)' week " +
    "with a 4-lesson block + practice + a resource + a checkpoint, which independently " +
    "look like 4h + 2h + 1h + ... but must always be re-packed to fit the budget)",
  () => {
    // Mirrors the real shape reported in production: multiple lessons, a
    // practice slot, a resource, and (on the final week of a month) a
    // checkpoint assessment, all landing on the same week for the same
    // skill -- exactly the case that has the most slots competing for one
    // week's budget.
    const content: Record<string, SkillLearningContent> = {
      "cloud-aws": {
        topicTitle: "Cloud (AWS) Fundamentals",
        lessons: [
          { title: "Core building blocks", practice: "Describe the policy change you'd make." },
          { title: "IAM and least privilege", practice: "Explain least privilege." },
          { title: "Security groups vs network ACLs", practice: "What's the risk?" },
          { title: "Regions and availability zones", practice: "What's the general fix?" },
        ],
        resources: [
          {
            title: "AWS Skill Builder",
            url: "https://skillbuilder.aws/",
            provider: "AWS",
            type: "site",
          },
        ],
        assessmentSlug: "aws-fundamentals",
        assessmentTitle: "AWS Fundamentals",
      },
      terraform: {
        topicTitle: "Terraform Fundamentals",
        lessons: [
          { title: "Providers, resources and the declarative model", practice: null },
          { title: "State: what it is and why it's dangerous to lose", practice: null },
        ],
        resources: [
          {
            title: "Complete Terraform Course",
            url: "https://youtube.com/x",
            provider: "TechWorld with Nana",
            type: "video",
          },
        ],
        assessmentSlug: "terraform-fundamentals",
        assessmentTitle: "Terraform Fundamentals",
      },
    };

    it.each([1, 2, 3, 4, 5, 6, 8, 10, 12])(
      "at %i hours/week, no week exceeds the cap even with a full lesson+practice+resource+checkpoint week",
      (hoursPerWeek) => {
        const required: RequiredSkill[] = [
          {
            skillId: "cloud-aws",
            name: "Cloud (AWS)",
            importance: "high",
            requiredLevel: "advanced",
            demandPercentage: 50,
          },
          {
            skillId: "terraform",
            name: "Terraform",
            importance: "high",
            requiredLevel: "advanced",
            demandPercentage: 50,
          },
        ];
        const gaps = buildSkillGaps(required, {});
        const months = buildRoadmap({ role: "Cloud Engineer", gaps, hoursPerWeek, content });
        expect(findWeeklyCapacityViolations(months, hoursPerWeek)).toEqual([]);
      },
    );
  },
);
