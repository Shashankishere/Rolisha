/**
 * Pure decision logic for the Jobs Explorer's keyword + location search.
 *
 * The Jobs Explorer intentionally never fires a server search while the
 * user is typing. Typing only ever updates local component state; a search
 * is only ever triggered by an explicit action (clicking "Search" or
 * pressing Enter in the keyword or location field). This module is kept
 * separate from the React components that use it (`jobs.index.tsx`,
 * `job-filters-panel.tsx`) so the "should this actually fire a new search?"
 * rule is unit-testable without a DOM.
 */

export interface JobSearchTextFields {
  search: string;
  location: string;
}

/**
 * True when the pending (in-progress, not-yet-submitted) keyword or
 * location text differs from what's already applied. Used to skip a
 * redundant request when Search/Enter is triggered without anything
 * actually having changed (e.g. pressing Enter twice on the same query).
 */
export function hasPendingSearchChanged(
  pending: JobSearchTextFields,
  applied: JobSearchTextFields,
): boolean {
  return pending.search !== applied.search || pending.location !== applied.location;
}

/**
 * Decides whether a submit attempt (Search click or Enter press) should
 * actually go through. Combines the "did anything change" check above with
 * a submission lock so that a second submit attempt while the first is
 * still in flight (e.g. a fast double-click, or Enter followed immediately
 * by clicking Search) is ignored rather than firing a duplicate request.
 */
export function shouldSubmitJobSearch(
  pending: JobSearchTextFields,
  applied: JobSearchTextFields,
  isSubmitLocked: boolean,
): boolean {
  if (isSubmitLocked) return false;
  return hasPendingSearchChanged(pending, applied);
}
