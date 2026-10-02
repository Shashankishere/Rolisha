/**
 * Job-description cleanup.
 *
 * Providers like Adzuna hand back one flat string, and many employers paste
 * "Location: … Experience: …" and section titles straight into it. This module
 * turns that blob into readable text (one field/section per line) and pulls
 * out the facts we can store as real columns (experience, work mode).
 *
 * Pure and idempotent: running it on already-formatted text is a no-op, so it
 * is safe both at ingestion time and at render time (for rows ingested before
 * this existed).
 */
import type { WorkMode } from "@/lib/domain";

/** "Label: value" lines employers commonly paste at the top of a posting. */
const FIELD_LABELS = [
  "Location",
  "Experience",
  "Notice Period",
  "Work Mode",
  "Work Type",
  "Job Type",
  "Employment Type",
  "Qualification",
  "Education",
];

/** Section titles that are recognisable without a colon (multi-word, Title Case). */
const PLAIN_HEADINGS = [
  "Role Overview",
  "Job Overview",
  "Job Description",
  "About the Role",
  "About the Job",
  "About the Company",
  "About Us",
  "Key Responsibilities",
  "Roles and Responsibilities",
  "Roles & Responsibilities",
  "Required Skills",
  "Preferred Skills",
  "Required Qualifications",
  "Preferred Qualifications",
  "Nice to Have",
  "What We Offer",
];

/** Generic one-word titles; only treated as headings when followed by a colon. */
const COLON_HEADINGS = ["Responsibilities", "Requirements", "Qualifications", "Skills", "Benefits"];

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

const alt = (words: string[]) =>
  [...words]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&"))
    .join("|");

const FIELD_BREAK_RE = new RegExp(`[ \\t]+(${alt(FIELD_LABELS)})[ \\t]*:`, "g");
const PLAIN_HEADING_RE = new RegExp(`\\s*\\b(${alt(PLAIN_HEADINGS)})\\b[ \\t]*:?\\s*`, "g");
const COLON_HEADING_RE = new RegExp(`\\s*\\b(${alt(COLON_HEADINGS)})[ \\t]*:\\s*`, "g");

export interface ParsedDescription {
  /** Readable text: one field per line, blank line between sections. */
  text: string;
  /** Minimum years of experience, if the posting states one. */
  experienceYearsMin: number | null;
  /** Work mode, if a Location / Work Mode line states one. */
  workMode: WorkMode | null;
}

function stripMarkup(raw: string): string {
  return raw
    .replace(/<\s*br\s*\/?>|<\/(p|div|li|h[1-6]|ul|ol)>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function parseExperienceYears(value: string): number | null {
  const m = value.match(/(\d{1,2})\s*(?:[-–—]|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)\b/i);
  if (!m) return null;
  const years = Number(m[1]);
  return years >= 0 && years <= 40 ? years : null;
}

function parseWorkMode(value: string): WorkMode | null {
  const v = value.toLowerCase();
  if (/\bremote\b|work from home|\bwfh\b/.test(v)) return "remote";
  if (/\bhybrid\b/.test(v)) return "hybrid";
  if (/\bon[\s-]?site\b|\bwork from office\b|\bwfo\b/.test(v)) return "onsite";
  return null;
}

export function parseJobDescription(
  raw: string | null | undefined,
  title?: string | null,
): ParsedDescription {
  if (!raw) return { text: "", experienceYearsMin: null, workMode: null };

  let text = stripMarkup(raw)
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*[•●▪◦■]\s*/g, "\n• ");

  // Postings often start by repeating the job title.
  const t = title?.trim();
  if (t && text.trimStart().toLowerCase().startsWith(t.toLowerCase())) {
    text = text.trimStart().slice(t.length);
  }

  // Put every "Label:" field and section title on its own line.
  text = text
    .replace(FIELD_BREAK_RE, "\n$1:")
    .replace(PLAIN_HEADING_RE, "\n\n$1:\n")
    .replace(COLON_HEADING_RE, "\n\n$1:\n");

  let lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== ""));

  // Facts that become columns.
  let experienceYearsMin: number | null = null;
  let workMode: WorkMode | null = null;

  const expIdx = lines.findIndex((l) => /^Experience\s*:/i.test(l));
  if (expIdx >= 0) {
    const years = parseExperienceYears(lines[expIdx]!);
    if (years !== null) {
      experienceYearsMin = years;
      // It's shown in its own UI cell, so don't repeat it in the body.
      lines = lines.filter((_, i) => i !== expIdx);
    }
  }

  for (const l of lines) {
    if (/^(Location|Work Mode|Work Type)\s*:/i.test(l)) {
      workMode = parseWorkMode(l);
      if (workMode) break;
    }
  }

  // Fallback: "5+ years of experience" anywhere in the text.
  if (experienceYearsMin === null) {
    const m = lines
      .join(" ")
      .match(
        /(\d{1,2})\s*(?:[-–—]|to)?\s*\d{0,2}\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[a-z-]+\s+){0,2}experience/i,
      );
    if (m) {
      const years = Number(m[1]);
      if (years >= 0 && years <= 40) experienceYearsMin = years;
    }
  }

  text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, experienceYearsMin, workMode };
}

/** Convenience wrapper for display code that only needs the cleaned text. */
export function formatJobDescription(
  raw: string | null | undefined,
  title?: string | null,
): string {
  return parseJobDescription(raw, title).text;
}

/** A line like "Role Overview:" that the UI should render as a heading. */
export function isDescriptionHeading(line: string): boolean {
  return line.length <= 40 && /:$/.test(line) && !/[.!?]/.test(line);
}