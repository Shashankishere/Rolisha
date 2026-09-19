/**
 * Server-side resume file → plain text extraction for the AI Resume
 * Analysis / Optimization upload flow. Supports PDF and DOCX only.
 *
 * The uploaded file is never persisted anywhere (no storage bucket, no DB
 * row) — it's decoded in memory, converted to text, and discarded. That
 * sidesteps the "don't expose private resumes publicly" / "users can only
 * access their own uploads" requirements entirely: there is nothing stored
 * to leak or scope access to.
 */

export const RESUME_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const RESUME_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

export class ResumeExtractionError extends Error {}

function bytesFromBase64Length(base64Length: number): number {
  // Every 4 base64 chars encode 3 bytes; padding makes this an upper bound,
  // which is what we want for a size check before decoding.
  return Math.floor((base64Length * 3) / 4);
}

function detectKind(fileName: string, mimeType: string): "pdf" | "docx" {
  const lowerName = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }
  throw new ResumeExtractionError(
    "Unsupported file type. Please upload a PDF or DOCX (.pdf, .docx) resume.",
  );
}

/** Strips control characters / null bytes and collapses excess whitespace
 * before the text is ever handed to the AI pipeline. */
function sanitizeExtractedText(raw: string): string {
  return (
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim()
  );
}

export interface ExtractResumeInput {
  /** Raw file bytes, base64-encoded (no data: URL prefix). */
  fileBase64: string;
  fileName: string;
  mimeType: string;
}

export interface ExtractResumeResult {
  text: string;
  truncated: boolean;
}

/** Maximum characters handed onward to the AI analysis/optimization
 * pipeline — matches the existing `resumeText` server-side max length. */
const MAX_TEXT_CHARS = 20_000;

export async function extractResumeText({
  fileBase64,
  fileName,
  mimeType,
}: ExtractResumeInput): Promise<ExtractResumeResult> {
  if (!fileBase64 || fileBase64.length === 0) {
    throw new ResumeExtractionError("The uploaded file appears to be empty.");
  }

  const approxBytes = bytesFromBase64Length(fileBase64.length);
  if (approxBytes > RESUME_MAX_FILE_BYTES) {
    throw new ResumeExtractionError(
      `That file is too large. Please upload a resume under ${Math.floor(RESUME_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const kind = detectKind(fileName, mimeType);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(fileBase64, "base64");
  } catch {
    throw new ResumeExtractionError("Could not read this file. It may be corrupted.");
  }

  if (buffer.length === 0) {
    throw new ResumeExtractionError("The uploaded file appears to be empty.");
  }

  let rawText: string;
  try {
    if (kind === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        rawText = parsed.text ?? "";
      } finally {
        await parser.destroy();
      }
    } else {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      rawText = parsed.value ?? "";
    }
  } catch {
    throw new ResumeExtractionError(
      kind === "pdf"
        ? "This PDF couldn't be read. It may be corrupted, password protected, or a scanned image without selectable text."
        : "This DOCX file couldn't be read. It may be corrupted or in an unsupported format.",
    );
  }

  const cleaned = sanitizeExtractedText(rawText);

  if (cleaned.length < 50) {
    throw new ResumeExtractionError(
      "We couldn't find enough readable text in this file. If it's a scanned or image based resume, try pasting the text manually instead.",
    );
  }

  const truncated = cleaned.length > MAX_TEXT_CHARS;
  return {
    text: truncated ? cleaned.slice(0, MAX_TEXT_CHARS) : cleaned,
    truncated,
  };
}
