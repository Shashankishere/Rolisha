import { describe, expect, it } from "vitest";
import { normalizeStringList } from "@/lib/ai/normalize-list";

describe("normalizeStringList", () => {
  it("preserves an array of strings untouched (same reference, same order)", () => {
    const input = ["a", "b"];
    expect(normalizeStringList(input)).toBe(input);
  });

  it("converts a plain string into a single-item array, text unchanged", () => {
    expect(normalizeStringList("Add metrics to your projects.")).toEqual([
      "Add metrics to your projects.",
    ]);
  });

  it("keeps a multi-line paragraph without list markers as ONE item (not guessed apart)", () => {
    expect(normalizeStringList("Add metrics.\nTailor the summary.")).toEqual([
      "Add metrics. Tailor the summary.",
    ]);
  });

  it("splits numbered (1. / 2)) and bulleted (- * • –) lists, re-joining wrapped lines", () => {
    expect(normalizeStringList("1. One\n2) Two\n   wrapped\n- Three\n• Four")).toEqual([
      "One",
      "Two wrapped",
      "Three",
      "Four",
    ]);
  });

  it("parses a JSON array serialized in a string, including nested normalization", () => {
    expect(normalizeStringList('["a", "b"]')).toEqual(["a", "b"]);
    expect(normalizeStringList('[{"text": "a"}, {"recommendation": "b"}]')).toEqual(["a", "b"]);
  });

  it("treats bracketed text that is not valid JSON as prose", () => {
    expect(normalizeStringList("[not json] but advice")).toEqual(["[not json] but advice"]);
    expect(normalizeStringList("[not json]")).toEqual(["[not json]"]);
  });

  it("flattens {title, description} and text-like objects", () => {
    expect(normalizeStringList([{ title: "T", description: "D" }, { action: "Do X" }])).toEqual([
      "T: D",
      "Do X",
    ]);
  });

  it("returns empty / whitespace-only strings as an empty list (nothing to keep)", () => {
    expect(normalizeStringList("")).toEqual([]);
    expect(normalizeStringList("   \n ")).toEqual([]);
  });

  it("returns anything it cannot confidently interpret UNCHANGED so strict validation rejects it", () => {
    const obj = { anything: 1 };
    const mixed = ["ok", 3];
    const objsWithoutText = [{ a: 1 }];
    expect(normalizeStringList(42)).toBe(42);
    expect(normalizeStringList(null)).toBeNull();
    expect(normalizeStringList(undefined)).toBeUndefined();
    expect(normalizeStringList(obj)).toBe(obj);
    expect(normalizeStringList(mixed)).toBe(mixed);
    expect(normalizeStringList(objsWithoutText)).toBe(objsWithoutText);
  });
});
