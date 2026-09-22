/**
 * Server-side resume file → plain text extraction for the AI Resume
 * Analysis / Optimization upload flow. Supports PDF and DOCX only.
 *
 * The uploaded file is never persisted anywhere (no storage bucket, no DB
 * row) — it's decoded in memory, converted to text, and discarded. That
 * sidesteps the "don't expose private resumes publicly" / "users can only
 * access their own uploads" requirements entirely: there is nothing stored
 * to leak or scope access to.
 *
 * PDF on Cloudflare Workers -- why `loadPdfParse()` exists
 * `pdf-parse` (pdf.js) is written for Node. Loaded naively in a Worker,
 * `await import("pdf-parse")` throws `ReferenceError: DOMMatrix is not
 * defined` while the module is still evaluating, and the old catch-all turned
 * that into "this PDF may be corrupted". pdf-parse 2.x documents
 * `import "pdf-parse/worker"` (before `pdf-parse`) for serverless hosts, but on
 * Workers that entry needs three guarded accommodations, each verified against
 * the real workerd runtime -- see `loadPdfParse()`.
 */

import { DOMMatrix, ImageData, Path2D } from "./napi-canvas-shim";

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

/** Shown when the user's PDF itself can't be read. Kept verbatim from the
 * original implementation. */
const PDF_UNREADABLE_MESSAGE =
  "This PDF couldn't be read. It may be corrupted, password protected, or a scanned image without selectable text.";

/** Shown when OUR PDF runtime failed to start. The file may be perfectly fine,
 * so telling the user it is "corrupted" would be wrong and unactionable. */
const PDF_UNAVAILABLE_MESSAGE =
  "PDF reading is temporarily unavailable on our side. Please try again in a few minutes, or paste your resume text instead.";

const DOCX_UNREADABLE_MESSAGE =
  "This DOCX file couldn't be read. It may be corrupted or in an unsupported format.";

/** The pdf.js worker registers itself a moment after `pdf-parse/worker` loads;
 * we poll for it (500 x 10 ms = up to ~5 s) instead of racing it. */
const PDF_WORKER_REGISTER_ATTEMPTS = 500;
const PDF_WORKER_REGISTER_POLL_MS = 10;

/** Raised when pdf-parse could not be loaded or initialised in this runtime:
 * an environment problem, not a problem with the uploaded file. */
class PdfRuntimeInitError extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super("The PDF runtime could not be initialised.");
    this.name = "PdfRuntimeInitError";
    this.cause = cause;
  }
}

/**
 * Logs the underlying exception server-side with a context label so a
 * production failure is diagnosable. It deliberately records only the error's
 * own name / message / first stack lines and the payload SIZE -- never the file
 * name, the base64 payload, the extracted text, or any credential -- because a
 * resume is private user data.
 */
function logExtractionFailure(label: string, error: unknown, context: { bytes: number }): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[resume-extract] ${label}`, {
    bytes: context.bytes,
    errorName: err.name,
    errorMessage: err.message.slice(0, 300),
    stack: (err.stack ?? "").split("\n").slice(0, 4).join(" | ").slice(0, 500),
  });
}

type PdfParseCtor = typeof import("pdf-parse").PDFParse;
let pdfParseLoad: Promise<PdfParseCtor> | null = null;

function pdfWorkerRegistered(): boolean {
  const worker = (globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler?: unknown } })
    .pdfjsWorker;
  return Boolean(worker?.WorkerMessageHandler);
}

async function loadPdfParseOnce(): Promise<PdfParseCtor> {
  const g = globalThis as unknown as Record<string, unknown>;

  // (1) `pdf-parse/worker` normally installs these from the native
  //     `@napi-rs/canvas` addon, which cannot exist on Workers (vite.config.ts
  //     aliases it to napi-canvas-shim.ts). They must exist BEFORE the module
  //     graph first evaluates: pdf.js allocates a `DOMMatrix` at load time, and
  //     the bundler evaluates it ahead of the worker entry's own assignment.
  //     Only defined when missing, so Node keeps its real implementations.
  if (typeof g["DOMMatrix"] === "undefined") g["DOMMatrix"] = DOMMatrix;
  if (typeof g["Path2D"] === "undefined") g["Path2D"] = Path2D;
  if (typeof g["ImageData"] === "undefined") g["ImageData"] = ImageData;

  // (2) The documented serverless step: import `pdf-parse/worker` BEFORE
  //     `pdf-parse`. It registers the pdf.js worker in-process
  //     (`globalThis.pdfjsWorker`), which is what lets pdf.js run without
  //     spawning a Worker or `import()`ing a URL at runtime. Its top level does
  //     `fileURLToPath(import.meta.url)` unless `__dirname` is defined, and
  //     `import.meta.url` is undefined in a bundled Worker -- so a placeholder
  //     is provided only for the duration of this import (it is only used by
  //     the entry's `getPath()`, which we never call).
  const needsDirnamePlaceholder = typeof g["__dirname"] === "undefined";
  if (needsDirnamePlaceholder) g["__dirname"] = "/";
  try {
    await import("pdf-parse/worker");
  } finally {
    if (needsDirnamePlaceholder) delete g["__dirname"];
  }

  const { PDFParse } = await import("pdf-parse");

  // (3) The worker entry registers pdf.js's worker asynchronously (its dynamic
  //     import is not awaited), so wait until it is actually there.
  for (let attempt = 0; !pdfWorkerRegistered(); attempt++) {
    if (attempt >= PDF_WORKER_REGISTER_ATTEMPTS) {
      throw new Error("The pdf.js worker did not register in time.");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, PDF_WORKER_REGISTER_POLL_MS));
  }
  return PDFParse;
}

/** Loads pdf-parse once per isolate. A failure is not cached, so a later
 * request can retry instead of the isolate being permanently broken. */
function loadPdfParse(): Promise<PdfParseCtor> {
  if (!pdfParseLoad) {
    pdfParseLoad = loadPdfParseOnce().catch((error: unknown) => {
      pdfParseLoad = null;
      throw new PdfRuntimeInitError(error);
    });
  }
  return pdfParseLoad;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  let PDFParse: PdfParseCtor;
  try {
    PDFParse = await loadPdfParse();
  } catch (error) {
    logExtractionFailure(
      "PDF runtime initialization failed",
      error instanceof PdfRuntimeInitError ? error.cause : error,
      { bytes: buffer.length },
    );
    throw new ResumeExtractionError(PDF_UNAVAILABLE_MESSAGE);
  }

  try {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text ?? "";
    } finally {
      // Always release the parser/worker resources, and never let a failing
      // cleanup replace the real error (or a successful result).
      try {
        await parser.destroy();
      } catch (cleanupError) {
        logExtractionFailure("PDF parser cleanup failed", cleanupError, { bytes: buffer.length });
      }
    }
  } catch (error) {
    logExtractionFailure("PDF extraction failed", error, { bytes: buffer.length });
    throw new ResumeExtractionError(PDF_UNREADABLE_MESSAGE);
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value ?? "";
  } catch (error) {
    logExtractionFailure("DOCX extraction failed", error, { bytes: buffer.length });
    throw new ResumeExtractionError(DOCX_UNREADABLE_MESSAGE);
  }
}

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

  const rawText = kind === "pdf" ? await extractPdfText(buffer) : await extractDocxText(buffer);

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
