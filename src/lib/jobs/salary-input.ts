/**
 * Pure parsing logic for the Jobs Explorer's salary min/max filter inputs.
 *
 * The salary inputs keep their own local text state while the user is
 * typing (see `job-filters-panel.tsx`) and only convert that text to the
 * number stored in `JobFilters` when a value is actually committed
 * (debounced while typing, or immediately on blur/Enter). Keeping the
 * conversion here, separate from the React component, means the "did the
 * user type something we should treat as a salary" rule is unit-testable
 * without a DOM, and mirrors `job-search-submit.ts`.
 */

/**
 * Converts a salary input's raw text to the number stored in filters, or
 * null when the field is effectively empty. Never returns NaN: an
 * unparseable or negative value is treated the same as empty, since the
 * input's own `min={0}` and `type="number"` mean a negative or garbled
 * value was never a deliberate filter choice.
 */
export function parseSalaryInputValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Converts a stored salary filter value back to the text an input should
 * display. Kept alongside the parser since the two must round-trip
 * consistently — e.g. so clearing filters externally clears the input,
 * and re-deriving text from a committed value never shows something the
 * parser itself wouldn't have produced.
 */
export function salaryValueToInputText(value: number | null): string {
  return value === null ? "" : String(value);
}
