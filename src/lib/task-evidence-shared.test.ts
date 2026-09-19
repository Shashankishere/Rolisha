import { describe, expect, it } from "vitest";
import {
  EVIDENCE_MAX_FILE_BYTES,
  evidenceExtensionOf,
  formatEvidenceFileSize,
  isAcceptedEvidenceType,
} from "@/lib/task-evidence-shared";

describe("isAcceptedEvidenceType", () => {
  it("accepts a PNG with matching extension and MIME type", () => {
    expect(isAcceptedEvidenceType("screenshot.png", "image/png")).toBe(true);
  });

  it("accepts a PDF", () => {
    expect(isAcceptedEvidenceType("report.pdf", "application/pdf")).toBe(true);
  });

  it("rejects a script file", () => {
    expect(isAcceptedEvidenceType("script.sh", "application/x-sh")).toBe(false);
  });

  it("rejects a mismatched extension/MIME pair", () => {
    // Extension says PDF but the browser-reported MIME says PNG — neither
    // rule fully matches, so this should not be accepted.
    expect(isAcceptedEvidenceType("file.pdf", "image/png")).toBe(false);
  });

  it("is case-insensitive on the extension", () => {
    expect(isAcceptedEvidenceType("SCREENSHOT.PNG", "image/png")).toBe(true);
  });
});

describe("evidenceExtensionOf", () => {
  it("returns the lowercased extension including the dot", () => {
    expect(evidenceExtensionOf("Report.PDF")).toBe(".pdf");
  });

  it("returns an empty string for a file with no extension", () => {
    expect(evidenceExtensionOf("README")).toBe("");
  });
});

describe("formatEvidenceFileSize", () => {
  it("formats bytes", () => {
    expect(formatEvidenceFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatEvidenceFileSize(245 * 1024)).toBe("245 KB");
  });

  it("formats megabytes", () => {
    expect(formatEvidenceFileSize(EVIDENCE_MAX_FILE_BYTES)).toBe("10.0 MB");
  });
});
