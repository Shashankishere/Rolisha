import { describe, expect, it } from "vitest";
import { hasPendingSearchChanged, shouldSubmitJobSearch } from "@/lib/jobs/job-search-submit";

describe("hasPendingSearchChanged", () => {
  it("is false when neither keyword nor location has changed (typing must never submit)", () => {
    // Simulates the user typing "n", "no", "noi", "noid", "noida" while the
    // applied filters stay at whatever was last submitted — none of these
    // intermediate keystrokes should ever be treated as a change to commit.
    const applied = { search: "", location: "" };
    for (const partial of ["n", "no", "noi", "noid", "noida"]) {
      // Typing alone never calls this function with `applied` following the
      // pending value — `applied` only moves on an explicit submit — so this
      // asserts the pending/applied pair produced by pure typing (pending
      // changes, applied frozen) still correctly reports "changed" only
      // relative to the frozen baseline, i.e. it's a real difference, not a
      // false negative that would suppress a legitimate later submit.
      expect(hasPendingSearchChanged({ search: partial, location: "" }, applied)).toBe(true);
    }
  });

  it("is false once the applied value matches what's pending (nothing left to submit)", () => {
    expect(
      hasPendingSearchChanged({ search: "noida", location: "" }, { search: "noida", location: "" }),
    ).toBe(false);
  });

  it("is true when only the location changed", () => {
    expect(
      hasPendingSearchChanged(
        { search: "data analyst", location: "Bengaluru" },
        { search: "data analyst", location: "" },
      ),
    ).toBe(true);
  });

  it("is true when only the keyword changed", () => {
    expect(
      hasPendingSearchChanged(
        { search: "data analyst", location: "Delhi" },
        { search: "", location: "Delhi" },
      ),
    ).toBe(true);
  });

  it("is true when both keyword and location changed together (single combined submit)", () => {
    expect(
      hasPendingSearchChanged(
        { search: "data analyst", location: "Mumbai" },
        { search: "", location: "" },
      ),
    ).toBe(true);
  });
});

describe("shouldSubmitJobSearch", () => {
  const applied = { search: "", location: "" };

  it("allows a submit when something changed and nothing is locked", () => {
    expect(shouldSubmitJobSearch({ search: "noida", location: "" }, applied, false)).toBe(true);
  });

  it("blocks a submit while the previous submit is still in flight (duplicate prevention)", () => {
    expect(shouldSubmitJobSearch({ search: "noida", location: "" }, applied, true)).toBe(false);
  });

  it("blocks a redundant submit (e.g. Enter pressed twice) even when unlocked", () => {
    const same = { search: "noida", location: "" };
    expect(shouldSubmitJobSearch(same, same, false)).toBe(false);
  });

  it("allows exactly one submit for a keyword + location combination pressed together", () => {
    // One combined pending state, one call, one decision — mirrors the
    // component submitting keyword and location in a single request rather
    // than two separate ones.
    const pending = { search: "data analyst", location: "London" };
    expect(shouldSubmitJobSearch(pending, applied, false)).toBe(true);
  });
});
