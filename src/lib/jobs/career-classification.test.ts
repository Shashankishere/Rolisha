import { describe, expect, it } from "vitest";
import { classifyCareer, type CareerCatalogEntry } from "@/lib/jobs/career-classification";

const SKILL_SQL = "skill-sql";
const SKILL_EXCEL = "skill-excel";
const SKILL_REACT = "skill-react";
const SKILL_JS = "skill-js";
const SKILL_PYTHON = "skill-python";

const DATA_ANALYST: CareerCatalogEntry = {
  id: "career-data-analyst",
  slug: "data-analyst",
  title: "Data Analyst",
  shortDescription: "Turn raw data into decisions with SQL, spreadsheets and BI dashboards.",
  description: "Data Analysts collect, clean and interpret data using SQL and Excel.",
  skillIds: [SKILL_SQL, SKILL_EXCEL, SKILL_PYTHON],
};

const FRONTEND_DEVELOPER: CareerCatalogEntry = {
  id: "career-frontend-developer",
  slug: "frontend-developer",
  title: "Frontend Developer",
  shortDescription: "Build fast, accessible user interfaces for the web.",
  description: "Frontend Developers use React and JavaScript to build interfaces.",
  skillIds: [SKILL_REACT, SKILL_JS],
};

const CATALOG = [DATA_ANALYST, FRONTEND_DEVELOPER];

describe("classifyCareer — high-confidence classification", () => {
  it("classifies a clear Data Analyst posting via title + skills", () => {
    const result = classifyCareer(
      {
        title: "Senior Data Analyst",
        description: "You will write SQL queries and build Excel dashboards for stakeholders.",
        extractedSkillIds: [SKILL_SQL, SKILL_EXCEL],
      },
      CATALOG,
    );
    expect(result.careerId).toBe(DATA_ANALYST.id);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("classifies a clear Frontend Developer posting via title + skills", () => {
    const result = classifyCareer(
      {
        title: "Frontend Developer",
        description: "Build interfaces with React and modern JavaScript.",
        extractedSkillIds: [SKILL_REACT, SKILL_JS],
      },
      CATALOG,
    );
    expect(result.careerId).toBe(FRONTEND_DEVELOPER.id);
  });

  it("returns scores for every career in the catalog, sorted highest first", () => {
    const result = classifyCareer(
      {
        title: "Data Analyst",
        description: "SQL and Excel work.",
        extractedSkillIds: [SKILL_SQL, SKILL_EXCEL],
      },
      CATALOG,
    );
    expect(result.scores).toHaveLength(2);
    expect(result.scores[0]!.score).toBeGreaterThanOrEqual(result.scores[1]!.score);
  });
});

describe("classifyCareer — low-confidence classification (prefers NULL)", () => {
  it("returns null for a posting unrelated to anything in the catalog", () => {
    const result = classifyCareer(
      {
        title: "Warehouse Forklift Operator",
        description: "Operate heavy machinery in a logistics warehouse.",
        extractedSkillIds: [],
      },
      CATALOG,
    );
    expect(result.careerId).toBeNull();
  });

  it("returns null for an empty catalog", () => {
    const result = classifyCareer(
      { title: "Data Analyst", description: "SQL", extractedSkillIds: [SKILL_SQL] },
      [],
    );
    expect(result.careerId).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.scores).toEqual([]);
  });

  it("returns null when two careers are too close to call", () => {
    // Both careers share every signal equally — the tie-margin rule should
    // refuse to guess rather than pick one arbitrarily.
    const twin: CareerCatalogEntry = { ...DATA_ANALYST, id: "career-data-analyst-twin" };
    const result = classifyCareer(
      {
        title: "Data Analyst",
        description: "SQL and Excel work.",
        extractedSkillIds: [SKILL_SQL, SKILL_EXCEL],
      },
      [DATA_ANALYST, twin],
    );
    expect(result.careerId).toBeNull();
  });

  it("never assigns a career when the extracted skills and title share nothing with the catalog", () => {
    const result = classifyCareer(
      {
        title: "",
        description: null,
        extractedSkillIds: [],
      },
      CATALOG,
    );
    expect(result.careerId).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

describe("classifyCareer — determinism", () => {
  it("produces identical output for identical input", () => {
    const input = {
      title: "Data Analyst",
      description: "SQL and Excel work with dashboards.",
      extractedSkillIds: [SKILL_SQL, SKILL_EXCEL],
    };
    const a = classifyCareer(input, CATALOG);
    const b = classifyCareer(input, CATALOG);
    expect(a).toEqual(b);
  });
});
