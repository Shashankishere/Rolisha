/**
 * Shared domain model for Rolisha: proficiency maths, readiness scoring and
 * the transparent job-match algorithm. Pure functions only — safe on client
 * and server.
 */

export type ProficiencyLevel = "none" | "beginner" | "intermediate" | "advanced" | "expert";
export type SkillImportance = "nice_to_have" | "medium" | "high" | "critical";
export type ExperienceLevel = "none" | "lt_1" | "1_2" | "2_5" | "5_plus";
export type EducationLevel = "high_school" | "diploma" | "bachelors" | "masters" | "phd" | "other";
export type WorkMode = "remote" | "hybrid" | "onsite" | "any";
export type ApplicationStatus = "saved" | "applied" | "interview" | "offer" | "rejected";
export type SkillStatus = "ready" | "in_progress" | "missing";

export const PROFICIENCY_VALUE: Record<ProficiencyLevel, number> = {
  none: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

export const PROFICIENCY_LABEL: Record<ProficiencyLevel, string> = {
  none: "None",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export const IMPORTANCE_LABEL: Record<SkillImportance, string> = {
  nice_to_have: "Nice to have",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const IMPORTANCE_WEIGHT: Record<SkillImportance, number> = {
  nice_to_have: 0.5,
  medium: 1,
  high: 1.6,
  critical: 2.2,
};

export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  none: "No experience",
  lt_1: "Less than 1 year",
  "1_2": "1–2 years",
  "2_5": "2–5 years",
  "5_plus": "5+ years",
};

export const EXPERIENCE_YEARS: Record<ExperienceLevel, number> = {
  none: 0,
  lt_1: 0.5,
  "1_2": 1.5,
  "2_5": 3.5,
  "5_plus": 6,
};

export const EDUCATION_LABEL: Record<EducationLevel, string> = {
  high_school: "High school",
  diploma: "Diploma",
  bachelors: "Bachelor's",
  masters: "Master's",
  phd: "PhD",
  other: "Other",
};

export const EDUCATION_RANK: Record<EducationLevel, number> = {
  high_school: 1,
  diploma: 2,
  bachelors: 3,
  masters: 4,
  phd: 5,
  other: 2,
};

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  any: "No preference",
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export interface RequiredSkill {
  skillId: string;
  name: string;
  importance: SkillImportance;
  requiredLevel: ProficiencyLevel;
  demandPercentage: number | null;
}

export interface SkillGapRow extends RequiredSkill {
  yourLevel: ProficiencyLevel;
  gapPercentage: number;
  status: SkillStatus;
}

/** Coverage of a single requirement, 0–1, weighted by how far the user is. */
export function skillCoverage(your: ProficiencyLevel, required: ProficiencyLevel): number {
  const need = PROFICIENCY_VALUE[required];
  if (need === 0) return 1;
  return Math.min(1, PROFICIENCY_VALUE[your] / need);
}

export function skillStatus(your: ProficiencyLevel, required: ProficiencyLevel): SkillStatus {
  if (PROFICIENCY_VALUE[your] >= PROFICIENCY_VALUE[required]) return "ready";
  if (PROFICIENCY_VALUE[your] === 0) return "missing";
  return "in_progress";
}

export function buildSkillGaps(
  required: RequiredSkill[],
  userLevels: Record<string, ProficiencyLevel>,
): SkillGapRow[] {
  return required.map((req) => {
    const yourLevel = userLevels[req.skillId] ?? "none";
    const coverage = skillCoverage(yourLevel, req.requiredLevel);
    return {
      ...req,
      yourLevel,
      gapPercentage: Math.round((1 - coverage) * 100),
      status: skillStatus(yourLevel, req.requiredLevel),
    };
  });
}

/**
 * Readiness = importance-weighted coverage of the target role's skill profile.
 * Fully transparent: every input is visible in the skill matrix.
 */
export function readinessScore(rows: SkillGapRow[]): number {
  if (rows.length === 0) return 0;
  let earned = 0;
  let total = 0;
  for (const row of rows) {
    const weight = IMPORTANCE_WEIGHT[row.importance];
    total += weight;
    earned += weight * skillCoverage(row.yourLevel, row.requiredLevel);
  }
  return Math.round((earned / total) * 100);
}

export interface SkillGapReasonInput {
  importance: SkillImportance;
  status: SkillStatus;
  /** Real, currently-ingested live job posting demand for this skill, 0–100.
   * `null`/`undefined` when there isn't enough live data to compute it. */
  liveJobDemandPercentage?: number | null;
  /** Admin-curated static demand percentage from the career's skill profile
   * (`career_skills.demand_percentage`) — real data, just not live-refreshed. */
  demandPercentage?: number | null;
  /** Skill names earlier in the curriculum order that aren't ready yet. */
  prerequisites?: string[];
  targetRole?: string | null;
}

/**
 * Deterministic, non-fabricated explanation for why a user should learn a
 * recommended skill. Never invents job-market statistics: a percentage only
 * appears here when it's backed by real ingested job data or a real
 * admin-curated demand figure. When neither exists, falls back to the
 * skill's actual role in the user's curriculum (importance, prerequisite
 * relationships, career fit) instead of a data-availability disclaimer.
 */
export function skillGapReason(input: SkillGapReasonInput): string {
  const role = input.targetRole?.trim() || "your target career";

  if (input.liveJobDemandPercentage != null) {
    return `Required by ${input.liveJobDemandPercentage}% of matching live job postings.`;
  }

  if (input.demandPercentage != null) {
    return `Appears in ${input.demandPercentage}% of job postings for ${role}.`;
  }

  if (input.prerequisites && input.prerequisites.length > 0) {
    return `Builds on ${input.prerequisites.join(", ")}, which ${role} also requires.`;
  }

  switch (input.importance) {
    case "critical":
      return `This is a critical skill for ${role} — most postings for this role won't consider a candidate without it.`;
    case "high":
      return `This skill supports core responsibilities associated with ${role}.`;
    case "medium":
      return `This skill fills a gap between your current skills and the requirements of ${role}.`;
    case "nice_to_have":
    default:
      return `This skill strengthens an important competency for ${role}.`;
  }
}

export interface MatchWeights {
  skills: number;
  experience: number;
  education: number;
  location: number;
  salary: number;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  skills: 0.55,
  experience: 0.15,
  education: 0.1,
  location: 0.1,
  salary: 0.1,
};

export interface MatchInput {
  jobSkillIds: string[];
  userLevels: Record<string, ProficiencyLevel>;
  jobExperienceYearsMin: number | null;
  userExperience: ExperienceLevel;
  jobEducation: EducationLevel | null;
  userEducation: EducationLevel | null;
  jobWorkMode: WorkMode | null;
  userWorkMode: WorkMode | null;
  jobCountry: string | null;
  userCountry: string | null;
  jobSalaryMax: number | null;
  userSalaryTarget: number | null;
}

export interface MatchBreakdown {
  overall: number;
  skills: number;
  experience: number;
  education: number;
  location: number;
  salary: number;
  matchedSkillIds: string[];
  missingSkillIds: string[];
}

export function scoreJobMatch(
  input: MatchInput,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): MatchBreakdown {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const id of input.jobSkillIds) {
    const level = input.userLevels[id] ?? "none";
    if (PROFICIENCY_VALUE[level] >= 2) matched.push(id);
    else missing.push(id);
  }
  const skills = input.jobSkillIds.length
    ? Math.round((matched.length / input.jobSkillIds.length) * 100)
    : 0;

  const requiredYears = input.jobExperienceYearsMin ?? 0;
  const userYears = EXPERIENCE_YEARS[input.userExperience];
  const experience =
    requiredYears <= 0 ? 100 : Math.round(Math.min(1, userYears / requiredYears) * 100);

  let education = 100;
  if (input.jobEducation && input.userEducation) {
    education =
      EDUCATION_RANK[input.userEducation] >= EDUCATION_RANK[input.jobEducation] ? 100 : 65;
  }

  let location = 70;
  if (input.jobWorkMode === "remote" || input.userWorkMode === "any" || !input.userWorkMode) {
    location = 100;
  } else if (input.jobWorkMode === input.userWorkMode) {
    location = 95;
  } else if (input.userCountry && input.jobCountry && input.userCountry === input.jobCountry) {
    location = 80;
  } else if (input.jobCountry && input.userCountry) {
    location = 45;
  }

  let salary = 80;
  if (input.userSalaryTarget && input.jobSalaryMax) {
    salary = Math.round(Math.min(1, input.jobSalaryMax / input.userSalaryTarget) * 100);
  }

  const overall = Math.round(
    skills * weights.skills +
      experience * weights.experience +
      education * weights.education +
      location * weights.location +
      salary * weights.salary,
  );

  return {
    overall,
    skills,
    experience,
    education,
    location,
    salary,
    matchedSkillIds: matched,
    missingSkillIds: missing,
  };
}

export interface ReadinessTier {
  label: string;
  tier: "ready" | "almost" | "not_yet";
  reason: string;
}

/** Seniority readiness bands derived from the same transparent score. */
export function readinessTiers(role: string, score: number): ReadinessTier[] {
  const junior = `Junior ${role}`;
  const mid = role;
  const senior = `Senior ${role}`;
  const band = (threshold: number): ReadinessTier["tier"] =>
    score >= threshold ? "ready" : score >= threshold - 20 ? "almost" : "not_yet";
  return [
    {
      label: junior,
      tier: band(55),
      reason: `Junior postings usually expect around 55% of the role's skill profile. You are at ${score}%.`,
    },
    {
      label: mid,
      tier: band(75),
      reason: `Mid-level postings usually expect around 75% coverage plus applied project work. You are at ${score}%.`,
    },
    {
      label: senior,
      tier: band(90),
      reason: `Senior postings expect near-complete coverage (about 90%) and several years of experience. You are at ${score}%.`,
    },
  ];
}

export function scoreToLevel(scorePercent: number): ProficiencyLevel {
  if (scorePercent >= 90) return "advanced";
  if (scorePercent >= 60) return "intermediate";
  if (scorePercent >= 30) return "beginner";
  return "none";
}

/** Short, honest status line for the dashboard hero — derived from the same
 * transparent readiness score shown elsewhere, never a separate fabricated
 * assessment of the user. */
export function readinessStatusMessage(score: number): string {
  if (score >= 85) return "You're close to job ready. Keep sharpening the details.";
  if (score >= 60) return "Solid progress. A few gaps stand between you and ready.";
  if (score >= 30) return "Building momentum. Keep working through your roadmap.";
  return "Just getting started. Your first few completions will move this fast.";
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Locale used to format each currency so grouping/decimals read naturally
 * for that currency's usual audience, rather than forcing US grouping on
 * every currency. Falls back to "en-US" for anything not listed. */
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  GBP: "en-GB",
  INR: "en-IN",
  EUR: "de-DE",
  JPY: "ja-JP",
  CAD: "en-CA",
  AUD: "en-AU",
  SGD: "en-SG",
  NZD: "en-NZ",
  ZAR: "en-ZA",
  BRL: "pt-BR",
  MXN: "es-MX",
  AED: "ar-AE",
};

/**
 * Formats a single INR amount using Indian salary convention: lakhs per
 * annum ("LPA") rather than a fully-expanded rupee figure, e.g. 1200000
 * becomes "₹12 LPA" and 950000 becomes "₹9.5 LPA". Amounts under one lakh
 * fall back to plain Indian-grouped rupees since "LPA" wouldn't read
 * naturally for them.
 */
function formatInrLpa(value: number): string {
  if (Math.abs(value) < 100000) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  const lakhs = value / 100000;
  const rounded = Math.round(lakhs * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `₹${label} LPA`;
}

/**
 * Just the currency symbol/prefix a given currency code renders with (e.g.
 * "₹" for INR, "$" for USD) — built on the same `CURRENCY_LOCALE` table and
 * `Intl.NumberFormat` machinery as `formatSalary`, not a second/independent
 * currency system. Used for inputs where a single value is being edited in
 * one specific, known currency (e.g. a profile's own target salary) and the
 * symbol should sit beside the field rather than be baked into the number
 * itself, so the input's raw text can stay a plain, parseable number while
 * typing.
 *
 * Never used for anything that spans multiple currencies at once (e.g. the
 * Jobs Explorer's salary filter, which is compared against each job's own
 * currency) — a single symbol there would misrepresent what the number
 * means.
 */
export function currencySymbol(currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatSalary(value: number | null | undefined, currency = "USD"): string | null {
  if (value === null || value === undefined) return null;
  if (currency === "INR") return formatInrLpa(value);
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

/**
 * Formats a salary range honestly: never assumes USD when the currency is
 * unknown. If either bound is present but the currency could not be
 * determined, this says so explicitly rather than guessing — see
 * `currencyForCountry` for how currency is normally resolved.
 */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string {
  const hasAmount = (min !== null && min !== undefined) || (max !== null && max !== undefined);
  if (!hasAmount) return "Salary not provided";
  if (!currency) return "Salary currency unavailable";
  const minLabel = formatSalary(min, currency);
  const maxLabel = formatSalary(max, currency);
  if (minLabel && maxLabel && minLabel !== maxLabel) return `${minLabel} – ${maxLabel}`;
  return minLabel ?? maxLabel ?? "Salary currency unavailable";
}

/**
 * Strips a leading "Month N: " from a roadmap month's stored title (e.g.
 * "Month 1: Foundations" -> "Foundations"), for display contexts that
 * already show the month number some other way (the roadmap page's compact
 * career-path stepper shows it in a numbered circle above this label).
 *
 * PRODUCTION REGRESSION: the stepper used to render the full, un-stripped
 * title in an 80px single-line `truncate`d box, so every label rendered as
 * "Month 1: Fou...". Dropping the redundant, already-shown-elsewhere prefix
 * leaves enough room for the theme itself (e.g. "Interview readiness") to
 * actually fit. The month's full, untouched title is still used verbatim
 * everywhere else (the "Month 1: Foundations" section heading, etc.) --
 * this helper is only for that one compact label.
 */
export function stripMonthNumberPrefix(title: string): string {
  return title.replace(/^Month\s+\d+:\s*/i, "");
}
