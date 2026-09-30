/**
 * Public copy must match current product behaviour. Source-reading tests, in
 * the same style as marketing-copy-regressions.test.ts (the runner is
 * Node-only with no DOM). Each assertion protects a *source of truth*, not
 * an arbitrary number: the homepage stats must come from the catalogue
 * query, and plan limits quoted in copy must come from subscription.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FREE_CAREER_ROADMAPS,
  PLAN_TIERS,
  PRO_CAREER_ROADMAPS,
  getLimit,
} from "@/lib/subscription";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

const home = read("src/routes/index.tsx");
const pricing = read("src/routes/pricing.tsx");
const features = read("src/routes/features.tsx");
const catalogFns = read("src/lib/catalog.functions.ts");

describe("plan roadmap limits (Free = 1, Pro = 5, two plans only)", () => {
  it("Free allows exactly 1 roadmap and Pro at most 5", () => {
    expect(FREE_CAREER_ROADMAPS).toBe(1);
    expect(PRO_CAREER_ROADMAPS).toBe(5);
    expect(getLimit("free", "career_roadmaps")).toBe(1);
    expect(getLimit("pro", "career_roadmaps")).toBe(5);
  });

  it("Pro roadmaps are capped, never unlimited", () => {
    expect(getLimit("pro", "career_roadmaps")).not.toBeNull();
  });

  it("there are exactly two user-facing plans", () => {
    expect(PLAN_TIERS).toEqual(["free", "pro"]);
  });
});

describe("homepage catalogue statistics come from the catalogue, not hardcoded numbers", () => {
  it("feeds the stats strip from getCatalogStats", () => {
    expect(home).toContain("getCatalogStats");
    expect(home).toContain("catalog.careerPaths");
    expect(home).toContain("catalog.skills");
    expect(home).toContain("catalog.skillsWithLearningContent");
  });

  it("no longer hardcodes the old 8 / 50+ / 47 figures", () => {
    expect(home).not.toMatch(/value:\s*8\b/);
    expect(home).not.toMatch(/value:\s*50\b/);
    expect(home).not.toMatch(/value:\s*47\b/);
    expect(home).not.toMatch(/eight supported career paths/i);
  });

  it("keeps the roadmap horizon as an intentionally fixed six months", () => {
    expect(home).toContain('suffix: " months"');
    expect(home).toContain('label: "Roadmap horizon per plan"');
  });

  it("counts only active careers, all skills, and skills whose topics have lessons", () => {
    expect(catalogFns).toMatch(/from\("careers"\)[\s\S]*?\.eq\("is_active", true\)/);
    expect(catalogFns).toContain('from("skills")');
    expect(catalogFns).toContain('"skill_id, learning_lessons(id)"');
  });
});

describe("FAQ and plan copy reflect current behaviour", () => {
  it("does not claim unlimited roadmaps or a Premium tier", () => {
    for (const source of [home, pricing, features]) {
      expect(source).not.toMatch(/unlimited roadmaps/i);
      expect(source).not.toMatch(/paid plans add/i);
    }
  });

  it("does not advertise an application tracker (no such feature is built or gated)", () => {
    for (const source of [home, pricing, features]) {
      expect(source).not.toMatch(/application tracker/i);
    }
  });

  it("states the Pro roadmap cap from subscription.ts rather than a literal", () => {
    expect(home).toContain("${PRO_CAREER_ROADMAPS}");
    expect(pricing).toContain("${PRO_CAREER_ROADMAPS}");
  });

  it("no longer refers to data-mode labels or promises sample/live labelling everywhere", () => {
    for (const source of [home, features]) {
      expect(source).not.toMatch(/data mode/i);
      expect(source).not.toMatch(/whether you are looking at sample data/i);
    }
  });

  it("does not claim every job listing is live", () => {
    const faq = home.slice(home.indexOf("const FAQ"), home.indexOf("function Landing"));
    expect(faq).toMatch(/If no live listings are available/);
    expect(faq).not.toMatch(/every (job )?listing is live/i);
  });
});
