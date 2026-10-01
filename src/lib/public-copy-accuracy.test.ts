/**
 * Public copy must match current product behaviour. Source-reading tests, in
 * the same style as marketing-copy-regressions.test.ts (the runner is
 * Node-only with no DOM). Each assertion protects a *source of truth*
 * (subscription.ts for plan limits) or an exact, deliberately-chosen
 * headline value (the fixed catalogue stats), not an arbitrary number.
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

describe("homepage headline statistics are the deliberately-fixed floor values", () => {
  // These are marketing floors ("at least this many"), not a live catalogue
  // read -- they stay true as the catalogue grows and don't depend on a
  // database round trip to render the hero. See routes/index.tsx's STATS.
  const statsBlock = home.slice(home.indexOf("const STATS ="), home.indexOf("function Landing"));

  it("shows exactly 25+ / 75+ / 75+ / 6 months", () => {
    expect(statsBlock).toMatch(/value:\s*25,\s*suffix:\s*"\+"/);
    expect(statsBlock).toMatch(/value:\s*75,\s*suffix:\s*"\+"/);
    // Both 75+ stats must appear (skills tracked, skills with content).
    expect([...statsBlock.matchAll(/value:\s*75,\s*suffix:\s*"\+"/g)]).toHaveLength(2);
    expect(statsBlock).toMatch(/value:\s*6,\s*suffix:\s*" months"/);
  });

  it("keeps the four correct labels", () => {
    expect(statsBlock).toContain('label: "Supported career paths"');
    expect(statsBlock).toContain('label: "Skills tracked in the catalogue"');
    expect(statsBlock).toContain('label: "Skills with real learning content"');
    expect(statsBlock).toContain('label: "Roadmap horizon per plan"');
  });

  it("no longer shows the old exact-count values (8 / 50+ / 47, or the live-fetched 27 / 79 / 79)", () => {
    expect(statsBlock).not.toMatch(/value:\s*8,/);
    expect(statsBlock).not.toMatch(/value:\s*50,/);
    expect(statsBlock).not.toMatch(/value:\s*47,/);
    expect(statsBlock).not.toMatch(/value:\s*27,/);
    expect(statsBlock).not.toMatch(/value:\s*79,/);
  });

  it("does not fetch catalogue stats over the network for the hero", () => {
    expect(home).not.toContain("getCatalogStats");
  });
});

describe("stats strip is a centered group, not spread full-width", () => {
  const statsSection = home.slice(
    home.indexOf("ANIMATED STATS STRIP"),
    home.indexOf("<CareerJourneySection"), // the JSX usage, not the earlier import line
  );

  it("constrains the row to a narrower, centered container than the full-width hero", () => {
    expect(statsSection).toMatch(/mx-auto/);
    expect(statsSection).not.toMatch(/max-w-6xl/);
  });

  it("centers every stat (no left-aligned override on larger screens)", () => {
    expect(statsSection).not.toMatch(/md:text-left/);
  });
});

describe("hero positioning copy", () => {
  it('replaces "AI powered career intelligence" with the real-jobs tagline', () => {
    expect(home).not.toMatch(/AI powered career intelligence/i);
    expect(home).toContain("Your career path, mapped to what real jobs require.");
  });

  it("does not strip legitimate descriptions of real AI-powered features elsewhere", () => {
    // "career intelligence workspace" (features.tsx) describes the actual
    // analyse/plan/practise/apply/track product, not the removed hero badge
    // -- it must survive this positioning change.
    expect(features).toMatch(/career intelligence workspace/i);
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
