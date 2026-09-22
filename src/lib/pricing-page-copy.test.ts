/**
 * Pricing / plan copy regressions.
 *
 * Follows the repo's source-reading pattern (see marketing-copy-regressions
 * .test.ts): the pricing page is asserted against its own source so the
 * customer-visible strings cannot drift back to development-status wording,
 * a third tier, or claims about capabilities that do not exist.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FEATURE_INFO, PLAN_LABEL, PLAN_TIERS, type Feature } from "@/lib/subscription";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

/** Source with comments removed: comments legitimately explain history
 * ("there used to be a Premium tier") and are not customer-visible. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  // `withFileTypes: true` reports each entry's kind from the directory read itself, so
  // this needs one syscall per directory instead of one `readdirSync` PLUS one `statSync`
  // per entry -- material on `src`'s ~240 files when this runs on every test invocation.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const pricingSource = stripComments(read("src/routes/pricing.tsx"));

function proCardFeatures(): string[] {
  const proCard = pricingSource.slice(pricingSource.indexOf('tier: "pro" as const'));
  const block = proCard.slice(proCard.indexOf("features: ["), proCard.indexOf("cta:"));
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!).filter((s) => s !== "features");
}

function comparisonLabels(): string[] {
  return [...pricingSource.matchAll(/\{\s*label:\s*"([^"]+)"/g)].map((m) => m[1]!);
}

/** The seven capabilities that used to sit in the removed Premium tier. */
const FORMER_PREMIUM: { id: Feature; card: string }[] = [
  { id: "resume_analysis", card: "AI resume analysis" },
  { id: "resume_optimization", card: "Resume optimization" },
  { id: "interview_preparation", card: "Interview preparation" },
  { id: "personalized_interview_questions", card: "Personalized interview questions" },
  { id: "mock_interviews", card: "Mock interviews" },
  { id: "career_switch_analysis", card: "Career switch analysis" },
  { id: "ai_career_recommendations", card: "AI career recommendations" },
];

describe("pricing page shows exactly the two current plans", () => {
  it("has a Free card and a Pro card, and no third tier", () => {
    expect(pricingSource).toContain('tier: "free" as const');
    expect(pricingSource).toContain('tier: "pro" as const');
    expect(pricingSource).not.toMatch(/tier:\s*"premium"/i);
    expect([...pricingSource.matchAll(/tier:\s*"/g)]).toHaveLength(2);
  });

  it("the comparison table has only Free and Pro columns", () => {
    const headers = [...pricingSource.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]!.trim());
    expect(headers).toEqual(["Feature", "Free", "Pro"]);
  });

  it("the app's plan model is exactly free | pro, and legacy 'premium' is not an active plan", () => {
    expect(PLAN_TIERS).toEqual(["free", "pro"]);
    expect(Object.keys(PLAN_LABEL)).toEqual(["free", "pro"]);
  });

  it("the Premium -> Pro consolidation migration is still in the repository", () => {
    expect(
      existsSync(join(ROOT, "supabase/migrations/20260919000000_consolidate_premium_into_pro.sql")),
    ).toBe(true);
  });

  it("legacy Premium survives only as a labelled historical BILLING record, never as a plan choice", () => {
    const panel = read("src/components/app/subscription-panel.tsx");
    expect(panel).toContain('premium: "Premium (legacy)"');
  });
});

describe("no development-status wording in the pricing UI", () => {
  it("contains no 'Planned', 'Premium', 'coming soon' or 'nothing is implemented' text", () => {
    expect(pricingSource).not.toMatch(/planned/i);
    expect(pricingSource).not.toMatch(/premium/i);
    expect(pricingSource).not.toMatch(/coming soon/i);
    expect(pricingSource).not.toMatch(/nothing is implemented/i);
    expect(pricingSource).not.toMatch(/pretend/i);
    expect(pricingSource).not.toMatch(/gated identifiers/i);
  });

  it("the comparison table no longer has an 'implemented' column or a '(Planned)' marker", () => {
    expect(pricingSource).not.toMatch(/implemented/);
    expect(pricingSource).not.toContain("(Planned)");
  });

  it("no other customer-visible component says 'Planned'", () => {
    for (const rel of [
      "src/components/app/upgrade-prompt.tsx",
      "src/components/app/subscription-panel.tsx",
      "src/routes/_authenticated/premium.index.tsx",
    ]) {
      expect(stripComments(read(rel)), rel).not.toMatch(/planned/i);
    }
  });

  it("the public landing page no longer describes a not-yet-connected data source", () => {
    const landing = stripComments(read("src/routes/index.tsx"));
    expect(landing).not.toMatch(/until a live source is connected/i);
    expect(landing).not.toMatch(/connected by your workspace/i);
  });
});

describe("implemented Pro features are displayed correctly", () => {
  it.each(FORMER_PREMIUM)(
    "$card is built, Pro-gated, and listed in both the card and the table",
    ({ id, card }) => {
      expect(FEATURE_INFO[id].implemented).toBe(true);
      expect(FEATURE_INFO[id].requiredPlan).toBe("pro");
      expect(proCardFeatures()).toContain(card);
      const row = comparisonLabels().indexOf(card);
      expect(row).toBeGreaterThanOrEqual(0);
    },
  );

  it("every advertised feature's table row is Pro-included and Free only where Free really has it", () => {
    const rows = [
      ...pricingSource.matchAll(
        /\{\s*label:\s*"([^"]+)",\s*free:\s*(true|false),\s*pro:\s*(true|false)/g,
      ),
    ];
    expect(rows.length).toBeGreaterThan(15);
    for (const [, label, free, pro] of rows) {
      expect(pro, `${label} must be included in Pro`).toBe("true");
      if (FORMER_PREMIUM.some((f) => f.card === label)) {
        expect(free, `${label} is Pro-only`).toBe("false");
      }
    }
  });

  it("keeps the Free limits and the Pro price wiring untouched", () => {
    expect(pricingSource).toContain("Limited learning (5 lessons)");
    expect(pricingSource).toContain("Basic assessments (3)");
    expect(pricingSource).toContain("Limited projects (2)");
    expect(pricingSource).toContain("formatPrice(region.pro, region)");
    expect(pricingSource).toContain("Everything in Free, plus:");
  });
});

describe("AI learning recommendations: advertised if and only if genuinely implemented", () => {
  const label = FEATURE_INFO.ai_personalization.label; // "AI powered learning recommendations"

  /** A feature is "implemented" for marketing purposes only if a server module
   * actually enforces/uses its gate; the registry flag alone is not proof.
   *
   * Memoized: both tests below call this, and re-walking + re-reading all of `src` a
   * second time bought nothing but doubled cost -- the source tree does not change
   * between them, so recomputing per-call was pure waste, not extra safety. */
  let gateUsed: boolean | undefined;
  function gateIsUsedByAnyFeature(): boolean {
    if (gateUsed === undefined) {
      gateUsed = walk(join(ROOT, "src"))
        .filter((f) => !f.endsWith("subscription.ts") && !f.endsWith("routeTree.gen.ts"))
        .some((f) => /["']ai_personalization["']/.test(readFileSync(f, "utf-8")));
    }
    return gateUsed;
  }

  it("is currently NOT implemented: the gate exists but nothing uses it, and it is flagged unimplemented", () => {
    expect(FEATURE_INFO.ai_personalization.implemented).toBe(false);
    expect(gateIsUsedByAnyFeature()).toBe(false);
  });

  it("therefore it is not advertised anywhere on the pricing page (card, table, or footnote)", () => {
    const advertised = gateIsUsedByAnyFeature() && FEATURE_INFO.ai_personalization.implemented;
    const mentioned =
      pricingSource.includes(label) || /learning recommendations/i.test(pricingSource);
    // Both directions: never claim an unbuilt feature, never hide a built one.
    expect(mentioned).toBe(advertised);
  });

  it("no registry feature that is unimplemented is advertised on the pricing page", () => {
    for (const info of Object.values(FEATURE_INFO)) {
      if (!info.implemented) expect(pricingSource).not.toContain(info.label);
    }
  });

  it("the account 'Included in <plan>' list never shows an unimplemented feature, for any plan", () => {
    const panel = stripComments(read("src/components/app/subscription-panel.tsx"));
    expect(panel).toContain(".filter((f) => FEATURE_INFO[f].implemented)");
    expect(panel).not.toMatch(/implemented\s*\|\|/);
  });
});

describe("locked-feature badges never use 'Planned' wording", () => {
  it("UpgradePrompt and LockedBadge say 'Not available yet' for an unbuilt feature", () => {
    const source = stripComments(read("src/components/app/upgrade-prompt.tsx"));
    expect(source).not.toMatch(/planned/i);
    expect(source).toContain("Not available yet");
  });
});
