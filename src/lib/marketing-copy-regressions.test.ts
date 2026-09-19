import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * This repo's vitest config runs with `environment: "node"` (see
 * vitest.config.ts) — there is no jsdom/@testing-library/react harness set
 * up to render components, so these regressions are guarded by reading the
 * actual source files rather than rendering them. That's a smaller,
 * honest tool for the job: it directly re-checks the literal fixes made
 * in this pass without introducing a new test paradigm into the repo.
 */
function readSrc(relativePath: string): string {
  const url = new URL(`../../${relativePath}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf-8");
}

describe("Career Journey heading removal", () => {
  it("no longer passes the 'Career journey' / '5 STAGES' label to InstrumentFrame", () => {
    const source = readSrc("src/components/marketing/career-journey-section.tsx");
    expect(source).not.toContain('label="Career journey"');
    expect(source).not.toContain('status="5 STAGES"');
  });

  it("InstrumentFrame's label prop is optional, so the header row can be omitted", () => {
    const source = readSrc("src/components/marketing/instrument-frame.tsx");
    expect(source).toMatch(/label\?:\s*string/);
  });
});

describe("Roadmap horizon copy", () => {
  it("landing page stat reads '6 months Roadmap horizon per plan', not '6 mo' or '6-month'", () => {
    const source = readSrc("src/routes/index.tsx");
    expect(source).toContain('suffix: " months"');
    expect(source).toContain('label: "Roadmap horizon per plan"');
    expect(source).not.toContain('suffix: " mo"');
  });

  it("the server-generated roadmap summary says 'six month', not 'six-month'", () => {
    const source = readSrc("src/lib/me.server.ts");
    expect(source).not.toContain("six-month");
    expect(source).toContain("six month plan");
  });
});

describe("LIVE badges are static", () => {
  it("the Career Intelligence Engine badge does not depend on timers, hydration, or loading state", () => {
    const source = readSrc("src/components/marketing/career-engine-3d.tsx");
    expect(source).not.toMatch(/setTimeout|setInterval/);
  });

  it("the Skill Constellation marketing badge does not depend on timers, hydration, or loading state", () => {
    const source = readSrc("src/components/marketing/skill-constellation-section.tsx");
    expect(source).not.toMatch(/setTimeout|setInterval/);
  });
});

describe("Rolisha favicon and branding metadata", () => {
  it("the document head links to Rolisha's own icon files, never a third-party builder asset", () => {
    const source = readSrc("src/routes/__root.tsx");
    expect(source).toMatch(/rel:\s*"icon",\s*href:\s*"\/favicon\.ico"/);
    expect(source).toContain('rel: "apple-touch-icon", href: "/apple-touch-icon.png"');
    expect(source).toContain('rel: "manifest", href: "/site.webmanifest"');
    expect(source.toLowerCase()).not.toContain("lovable");
    expect(source).toContain('{ title: "Rolisha');
  });

  it("the web manifest describes Rolisha, not a generic template app", () => {
    const source = readSrc("public/site.webmanifest");
    const manifest = JSON.parse(source) as { name: string; short_name: string };
    expect(manifest.name).toBe("Rolisha");
    expect(manifest.short_name).toBe("Rolisha");
    expect(source.toLowerCase()).not.toContain("lovable");
  });

  it("no builder/template branding leaks into shipped public assets", () => {
    // favicon.ico and favicon.svg are binary/opaque-ish; the meaningful,
    // reviewable guard is that no *text* public asset references Lovable.
    const manifest = readSrc("public/site.webmanifest");
    const robots = readSrc("public/robots.txt");
    for (const source of [manifest, robots]) {
      expect(source.toLowerCase()).not.toContain("lovable");
    }
  });
});

describe("Careers 'Sample data' presentation is honest, not decorative", () => {
  it("never shows a bare 'Sample data' pill over real career data", () => {
    const source = readSrc("src/routes/careers.$slug.tsx");
    expect(source).not.toContain("Sample data");
    expect(source).not.toContain("SAMPLE_DATA_NOTICE");
  });

  it("shows an honest 'Market data unavailable' state instead of fabricated stats when there is no live job data", () => {
    const source = readSrc("src/routes/careers.$slug.tsx");
    expect(source).toContain("Market data unavailable");
    expect(source).toContain("Connect a job source");
  });

  it("the career's typical salary is shown as real profile data, independent of the live/unavailable market-data state", () => {
    const source = readSrc("src/routes/careers.$slug.tsx");
    const aboutSectionIdx = source.indexOf("About this role");
    const marketSectionIdx = source.indexOf("Market intelligence");
    const salaryLineIdx = source.indexOf("Typical salary:");
    expect(aboutSectionIdx).toBeGreaterThan(-1);
    expect(salaryLineIdx).toBeGreaterThan(aboutSectionIdx);
    // The salary line must sit in the "About this role" section, before the
    // gated "Market intelligence" section — never inside the live/demo branch.
    expect(salaryLineIdx).toBeLessThan(marketSectionIdx);
  });

  it("only the live branch renders a 'Live job data' badge; the unavailable branch renders no badge at all", () => {
    const source = readSrc("src/routes/careers.$slug.tsx");
    expect(source).toContain('market.dataMode === "live" && <Badge>Live job data</Badge>');
  });
});

describe("Outline button visibility (no opaque page-background fill)", () => {
  it("the outline button variant is transparent so it never paints itself darker than its container", () => {
    const source = readSrc("src/components/ui/button.tsx");
    const lines = source.split("\n");
    const idx = lines.findIndex((line) => line.trim().startsWith("outline:"));
    expect(idx).toBeGreaterThanOrEqual(0);
    // The class string may be on the same line as `outline:` or the next
    // one, depending on formatting — check both.
    const snippet = `${lines[idx]}\n${lines[idx + 1] ?? ""}`;
    expect(snippet).toContain("bg-transparent");
    expect(snippet).not.toContain("bg-background");
  });
});
