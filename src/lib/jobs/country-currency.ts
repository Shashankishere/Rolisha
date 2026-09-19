/**
 * Deterministic country -> currency code mapping.
 *
 * Some job source adapters (e.g. Adzuna's free search endpoint) don't return
 * a currency code alongside the salary figures. Rather than hardcode "USD"
 * or "$" in the UI, this maps the job's already-stored `country` (ISO-ish
 * 2-letter code or country name, as supplied by the provider) to the
 * currency that country's job postings are virtually always denominated in.
 *
 * This is intentionally a display/storage mapping only — it does NOT convert
 * amounts between currencies. A salary of 90000 for a job in India is stored
 * and shown as ₹90,000, not converted to/from USD.
 *
 * Keep this list short and high-confidence. An unrecognized country returns
 * null, and callers should leave `salary_currency` unset rather than guess.
 */

const COUNTRY_CODE_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  UK: "GBP",
  IN: "INR",
  CA: "CAD",
  AU: "AUD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  IE: "EUR",
  PT: "EUR",
  AT: "EUR",
  SG: "SGD",
  NZ: "NZD",
  ZA: "ZAR",
  BR: "BRL",
  MX: "MXN",
  JP: "JPY",
  AE: "AED",
};

/** Longer country names as some providers/manual entries spell them out. */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  "UNITED KINGDOM": "GB",
  "GREAT BRITAIN": "GB",
  INDIA: "IN",
  CANADA: "CA",
  AUSTRALIA: "AU",
  GERMANY: "DE",
  FRANCE: "FR",
  SPAIN: "ES",
  ITALY: "IT",
  NETHERLANDS: "NL",
  IRELAND: "IE",
  PORTUGAL: "PT",
  AUSTRIA: "AT",
  SINGAPORE: "SG",
  "NEW ZEALAND": "NZ",
  "SOUTH AFRICA": "ZA",
  BRAZIL: "BR",
  MEXICO: "MX",
  JAPAN: "JP",
  "UNITED ARAB EMIRATES": "AE",
};

/**
 * Resolves a raw `country` value (2-letter code or a spelled-out name,
 * either case) down to its 2-letter code. Used wherever a real ISO-ish
 * code is required (e.g. Adzuna's `/jobs/{country}/search` endpoint) but
 * the stored value might be a full name. Returns null when unrecognized —
 * never guesses a default here; callers decide their own fallback.
 */
export function resolveCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const cleaned = country.trim().toUpperCase();
  if (!cleaned) return null;
  if (cleaned.length === 2 && COUNTRY_CODE_TO_CURRENCY[cleaned]) return cleaned;
  return COUNTRY_NAME_TO_CODE[cleaned] ?? null;
}

/**
 * Resolves a currency code for a raw `country` value (2-letter code or a
 * spelled-out name, either case). Returns null when the country is missing
 * or not recognized — never guesses.
 */
export function currencyForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const cleaned = country.trim().toUpperCase();
  if (!cleaned) return null;

  if (cleaned.length === 2 && COUNTRY_CODE_TO_CURRENCY[cleaned]) {
    return COUNTRY_CODE_TO_CURRENCY[cleaned];
  }

  const code = COUNTRY_NAME_TO_CODE[cleaned];
  if (code) return COUNTRY_CODE_TO_CURRENCY[code] ?? null;

  return null;
}
