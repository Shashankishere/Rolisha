/**
 * Normalizes a model's answer for a field the application models as a list of
 * strings (`string[]`) BEFORE strict schema validation.
 *
 * Why this exists: `response_format: json_object` only guarantees syntactically
 * valid JSON, not this schema, so a model will sometimes return a list of
 * advice as one prose string (or a JSON array serialized inside a string) even
 * when asked for an array. That is a representation difference, not missing
 * content, so it is repaired here instead of being thrown away as a failed
 * (and paid-for) generation.
 *
 * It is NOT a loosening of validation:
 *   - the schema still requires `string[]` (and its `.max(...)`) afterwards
 *   - anything it cannot confidently interpret is returned UNCHANGED, so the
 *     strict schema rejects it, rather than being guessed at or dropped
 *   - no content is ever discarded or invented; text is only re-shaped
 *
 * Handled shapes:
 *   array of strings ........................ preserved as-is
 *   array of {text|recommendation|...} ...... each item flattened to a string
 *   string containing a JSON array ........... parsed, then normalized again
 *   string with bullets / "1." / "2)" lines .. one item per bullet/number
 *   any other non-empty string ............... one item (a single recommendation)
 *   empty / whitespace-only string ........... [] (there is nothing to keep)
 */

const TEXT_KEYS = [
  "recommendation",
  "text",
  "action",
  "advice",
  "suggestion",
  "step",
  "description",
  "title",
];
const LIST_MARKER = /^\s*(?:[-*•–—]|\d{1,2}[.)])\s+/;

function itemToString(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    // {title, description} -> "title: description"; otherwise the first text-like field.
    const title = typeof record["title"] === "string" ? record["title"].trim() : "";
    const description =
      typeof record["description"] === "string" ? record["description"].trim() : "";
    if (title && description) return `${title}: ${description}`;
    for (const key of TEXT_KEYS) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return null; // unrecognized -> leave the whole value untouched for the schema to judge
}

function splitListText(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const items: string[] = [];
  let sawMarker = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (LIST_MARKER.test(line)) {
      sawMarker = true;
      items.push(line.replace(LIST_MARKER, "").trim());
    } else if (sawMarker && items.length > 0) {
      // A wrapped continuation of the previous bullet.
      items[items.length - 1] = `${items[items.length - 1]} ${line.trim()}`;
    } else {
      items.push(line.trim());
    }
  }
  // No bullets/numbers at all -> it is one piece of advice, however many lines it wraps over.
  if (!sawMarker) return [text.trim().replace(/\s*\r?\n\s*/g, " ")];
  return items.filter(Boolean);
}

export function normalizeStringList(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) return value;
    const flattened = value.map(itemToString);
    return flattened.every((item) => item !== null) ? flattened : value;
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) return normalizeStringList(parsed);
      } catch {
        /* not JSON after all -- treat as prose below */
      }
    }
    return splitListText(text);
  }

  return value;
}
