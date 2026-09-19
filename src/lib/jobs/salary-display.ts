/**
 * How a JOB's provider-supplied salary is shown on job cards and job detail.
 *
 * Rules (all deliberate):
 *  - The salary is shown in the job's OWN stored currency. Nothing is ever
 *    converted, and no symbol is ever guessed: an INR job never shows "$",
 *    a USD/GBP/EUR job never shows "₹".
 *  - Nothing is fabricated: no salary -> "Salary not provided"; amounts with
 *    no currency -> an honest "currency not specified" (no symbol invented).
 *  - Amounts are the provider's annual figures (the `jobs` table has no
 *    period column and Adzuna reports annual salaries), rendered in the
 *    conventions readers expect: INR in lakhs ("₹8–12 LPA"), everything else
 *    compact ("$80K–$100K", "£45K–£60K", "€50K–€65K").
 *  - One-sided ranges say so ("From ₹8 LPA" / "Up to $100K") instead of
 *    looking like an exact figure; a reversed min/max pair is put in order.
 *
 * This is separate from `formatSalaryRange` in domain.ts, which is still used
 * by career pages / settings and has its own pinned output. The user's Target
 * Salary (profile) is a different concept and never passes through here.
 */

export interface JobSalaryInput {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

export const SALARY_NOT_PROVIDED = "Salary not provided";
export const SALARY_CURRENCY_UNSPECIFIED = "Salary listed, currency not specified";

const LAKH = 100_000;

function cleanAmount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function cleanCurrency(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code ? code : null;
}

function lakhLabel(value: number): string {
  const rounded = Math.round((value / LAKH) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function inrPlain(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInr(lo: number | null, hi: number | null): string {
  const bounds = [lo, hi].filter((v): v is number => v !== null);
  const allLakhs = bounds.every((v) => v >= LAKH);

  if (lo !== null && hi !== null) {
    if (allLakhs) {
      const a = lakhLabel(lo);
      const b = lakhLabel(hi);
      return a === b ? `₹${a} LPA` : `₹${a}–${b} LPA`;
    }
    const a = lo >= LAKH ? `₹${lakhLabel(lo)} LPA` : inrPlain(lo);
    const b = hi >= LAKH ? `₹${lakhLabel(hi)} LPA` : inrPlain(hi);
    return a === b ? a : `${a}–${b}`;
  }

  const only = (lo ?? hi)!;
  const label = only >= LAKH ? `₹${lakhLabel(only)} LPA` : inrPlain(only);
  return lo !== null ? `From ${label}` : `Up to ${label}`;
}

function compactAmount(value: number, currency: string): string {
  try {
    // en-US keeps the symbol first and disambiguates dollar currencies
    // ("CA$", "A$") so a Canadian job never reads as a US one.
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      // Currency style defaults to 2 minimum fraction digits, which renders
      // "$80.0K"; 0..1 gives "$80K" and "$45.5K".
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    // Unrecognised currency code: show the code itself rather than a wrong symbol.
    const compact = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
    return `${currency} ${compact}`;
  }
}

function formatOther(lo: number | null, hi: number | null, currency: string): string {
  if (lo !== null && hi !== null) {
    const a = compactAmount(lo, currency);
    const b = compactAmount(hi, currency);
    return a === b ? a : `${a}–${b}`;
  }
  return lo !== null
    ? `From ${compactAmount(lo, currency)}`
    : `Up to ${compactAmount(hi!, currency)}`;
}

export function formatJobSalary(input: JobSalaryInput): string {
  let lo = cleanAmount(input.salaryMin);
  let hi = cleanAmount(input.salaryMax);
  if (lo === null && hi === null) return SALARY_NOT_PROVIDED;

  const currency = cleanCurrency(input.salaryCurrency);
  if (!currency) return SALARY_CURRENCY_UNSPECIFIED;

  if (lo !== null && hi !== null && lo > hi) [lo, hi] = [hi, lo];
  return currency === "INR" ? formatInr(lo, hi) : formatOther(lo, hi, currency);
}

/** True when the jobs that actually carry a salary use more than one currency
 * -- the only situation where saying "each employer's listed currency" helps. */
export function hasMixedSalaryCurrencies(jobs: readonly JobSalaryInput[]): boolean {
  const currencies = new Set<string>();
  for (const job of jobs) {
    if (cleanAmount(job.salaryMin) === null && cleanAmount(job.salaryMax) === null) continue;
    const currency = cleanCurrency(job.salaryCurrency);
    if (currency) currencies.add(currency);
  }
  return currencies.size > 1;
}
