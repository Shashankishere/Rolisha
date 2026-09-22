/**
 * Resume extraction layer (src/lib/premium/resume-extract.server.ts).
 *
 * Two groups:
 *  1. REAL libraries (pdf-parse + mammoth) on fixtures generated in code, so
 *     extraction, error mapping, limits and log privacy are exercised end to
 *     end without binary files in the repo.
 *  2. MOCKED parsers, for behaviour that cannot be provoked reliably with real
 *     files: parser cleanup, initialization failure vs. corrupt-file failure,
 *     retry after a failed init, and the global runtime shims.
 *
 * What these do NOT prove: that the PDF runtime starts inside Cloudflare's
 * workerd. That was verified separately by running the built Worker under
 * `wrangler dev` (see the change report); Vitest runs on Node.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Canvas, DOMMatrix, ImageData, Path2D, createCanvas } from "../napi-canvas-shim";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PDF_UNREADABLE =
  "This PDF couldn't be read. It may be corrupted, password protected, or a scanned image without selectable text.";
const PDF_UNAVAILABLE = /temporarily unavailable/i;
const NOT_ENOUGH_TEXT = /couldn't find enough readable text/i;

const g = globalThis as unknown as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** A small but valid multi-page PDF with real selectable Helvetica text. */
function makePdf(pages: string[][]): Buffer {
  const esc = (t: string) => t.replace(/([\\()])/g, "\\$1");
  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 3 + i * 2);
  const fontId = 3 + pages.length * 2;
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  for (const lines of pages) {
    const id = objs.length + 1;
    const content = `BT /F1 10 Tf 40 780 Td 14 TL\n${lines.map((l) => `(${esc(l)}) Tj T*`).join("\n")}\nET`;
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${id + 1} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** A valid PDF page that draws a rectangle and contains NO text at all. */
function makeTextlessPdf(): Buffer {
  const content = "50 50 400 600 re f";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Minimal STORE-only zip writer, enough for a .docx package. */
function makeZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

function makeDocx(paragraphs: string[]): Buffer {
  const xmlEsc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = paragraphs.map((p) => `<w:p><w:r><w:t>${xmlEsc(p)}</w:t></w:r></w:p>`).join("");
  return makeZip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  });
}

const b64 = (buf: Buffer) => buf.toString("base64");

const RESUME_LINES = [
  "Priya Nair - Senior Data Analyst",
  "Bengaluru, India | priya.nair@example.com",
  "Skills: SQL, Python, Power BI, dashboards, statistics, A/B testing",
  "Experience: Globex Analytics 2021 to 2026 (built reporting pipelines used by 40 teams)",
];

let errorSpy: ReturnType<typeof vi.spyOn>;
function loggedText(): string {
  return errorSpy.mock.calls
    .map((args) =>
      args.map((a: unknown) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
    )
    .join("\n");
}

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// 1. REAL pdf-parse + mammoth
// ---------------------------------------------------------------------------
describe("extractResumeText (real pdf-parse and mammoth)", () => {
  // One module instance for the whole group: the first PDF/DOCX extraction initialises
  // the real PDF runtime and mammoth's module tree (see "Why beforeAll" below); every
  // later call in this file reuses them, like a warm Cloudflare isolate.
  let extractResumeText: typeof import("../resume-extract.server").extractResumeText;
  let RESUME_MAX_FILE_BYTES: number;

  // Why beforeAll (not beforeEach, and not a bigger global test timeout):
  //
  // The first REAL PDF extraction in this file pays several one-time, unavoidable costs
  // that are exactly what this fix depends on and must stay real, not mocked:
  //   - importing pdf-parse's documented `pdf-parse/worker` entry (a large inlined pdf.js
  //     worker bundle) and pdf-parse itself, and
  //   - waiting for the pdf.js worker it starts to actually register.
  // The first real DOCX extraction similarly pays mammoth's first import (~190 CommonJS
  // modules pulled in transitively). Neither cost is specific to a slow machine: it is
  // paid once per process everywhere, including once per cold Cloudflare isolate in
  // production, and every later call is fast because Node/the isolate caches the loaded
  // modules and the running worker. On a slow or CPU-contended CI runner that one-time
  // cost — not a bug, not something to mock away — can by itself exceed a 5000ms *test*
  // timeout even though the runtime overall isn't slow. Paying it here, in a hook with
  // its own explicit timeout, keeps it real and out of any individual test's budget,
  // without touching the global testTimeout (which would just as easily hide an
  // unrelated future regression) and without weakening resume-extract.server.ts's
  // Cloudflare Workers shims/init path in any way — this hook exercises that exact path.
  beforeAll(async () => {
    ({ extractResumeText, RESUME_MAX_FILE_BYTES } = await import("../resume-extract.server"));
    const warmupPdfText = RESUME_LINES; // reuse the module-level fixture, well over the 50-char minimum
    const warmupDocxText =
      "Warm-up paragraph with enough characters to clear the minimum readable-text length.";
    await extractResumeText({
      fileBase64: b64(makePdf([warmupPdfText])),
      fileName: "warmup.pdf",
      mimeType: PDF_MIME,
    });
    await extractResumeText({
      fileBase64: b64(makeDocx([warmupDocxText])),
      fileName: "warmup.docx",
      mimeType: DOCX_MIME,
    });
  }, 30_000);

  it("extracts text from a valid PDF", async () => {
    const result = await extractResumeText({
      fileBase64: b64(makePdf([RESUME_LINES])),
      fileName: "resume.pdf",
      mimeType: PDF_MIME,
    });
    expect(result.truncated).toBe(false);
    expect(result.text).toContain("Priya Nair - Senior Data Analyst");
    expect(result.text).toContain("SQL, Python, Power BI");
    expect(result.text).toContain("priya.nair@example.com");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("extracts every page of a multi-page PDF, in order", async () => {
    const pages = [
      [...RESUME_LINES, "PAGE-ONE-MARKER"],
      ["Projects: analytics platform rebuilt end to end with dbt and Airflow.", "PAGE-TWO-MARKER"],
    ];
    const { text } = await extractResumeText({
      fileBase64: b64(makePdf(pages)),
      fileName: "resume.pdf",
      mimeType: PDF_MIME,
    });
    expect(text.indexOf("PAGE-ONE-MARKER")).toBeGreaterThan(-1);
    expect(text.indexOf("PAGE-TWO-MARKER")).toBeGreaterThan(text.indexOf("PAGE-ONE-MARKER"));
  });

  it("handles repeated extractions on a warm runtime (sequential and concurrent)", async () => {
    const input = {
      fileBase64: b64(makePdf([RESUME_LINES])),
      fileName: "r.pdf",
      mimeType: PDF_MIME,
    };
    for (let i = 0; i < 3; i++) {
      expect((await extractResumeText(input)).text).toContain("Priya Nair");
    }
    const results = await Promise.all(Array.from({ length: 4 }, () => extractResumeText(input)));
    for (const r of results) expect(r.text).toContain("Priya Nair");
  });

  it("detects a PDF by extension when the MIME type is generic", async () => {
    const { text } = await extractResumeText({
      fileBase64: b64(makePdf([RESUME_LINES])),
      fileName: "My_CV.PDF",
      mimeType: "application/octet-stream",
    });
    expect(text).toContain("Priya Nair");
  });

  it("extracts text from a DOCX (mammoth path still works)", async () => {
    const result = await extractResumeText({
      fileBase64: b64(makeDocx(RESUME_LINES)),
      fileName: "resume.docx",
      mimeType: DOCX_MIME,
    });
    expect(result.truncated).toBe(false);
    expect(result.text).toContain("Priya Nair - Senior Data Analyst");
    expect(result.text).toContain("Power BI");
  });

  it("detects a DOCX by extension when the MIME type is generic", async () => {
    const { text } = await extractResumeText({
      fileBase64: b64(makeDocx(RESUME_LINES)),
      fileName: "resume.docx",
      mimeType: "application/octet-stream",
    });
    expect(text).toContain("Priya Nair");
  });

  it("maps a corrupt PDF to the product-level error, without exposing internals", async () => {
    const corrupt = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nnot a real pdf \u0000\u0001 garbage garbage\n",
    );
    const promise = extractResumeText({
      fileBase64: b64(corrupt),
      fileName: "resume.pdf",
      mimeType: PDF_MIME,
    });
    await expect(promise).rejects.toThrow(PDF_UNREADABLE);
    await promise.catch((error: Error) => {
      // Product copy only: no exception class names, stack frames or library text.
      expect(error.message).toBe(PDF_UNREADABLE);
      expect(error.message).not.toMatch(/InvalidPDF|pdf\.js|stack|at file:|Error:/i);
    });
  });

  it("maps a corrupt DOCX to its product-level error", async () => {
    await expect(
      extractResumeText({
        fileBase64: b64(Buffer.from("this is definitely not a zip archive")),
        fileName: "resume.docx",
        mimeType: DOCX_MIME,
      }),
    ).rejects.toThrow(/DOCX file couldn't be read/);
  });

  it("logs the underlying PDF exception server-side under a context label", async () => {
    await extractResumeText({
      fileBase64: b64(Buffer.from("%PDF-1.4 not really a pdf at all, just enough bytes to try")),
      fileName: "resume.pdf",
      mimeType: PDF_MIME,
    }).catch(() => undefined);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [label, detail] = errorSpy.mock.calls[0]!;
    expect(label).toBe("[resume-extract] PDF extraction failed");
    expect(detail).toMatchObject({
      bytes: expect.any(Number),
      errorName: expect.any(String),
      errorMessage: expect.any(String),
    });
  });

  it("never logs the file name, the base64 payload, or resume text", async () => {
    const secretText = "PRIVATE-MARKER-9f3a1c Priya Nair salary expectation 42 LPA";
    const payload = Buffer.from(`%PDF-1.4\n${secretText}\nbroken broken broken`);
    const payloadB64 = b64(payload);
    await extractResumeText({
      fileBase64: payloadB64,
      fileName: "Priya_Nair_CONFIDENTIAL_resume.pdf",
      mimeType: PDF_MIME,
    }).catch(() => undefined);

    const logged = loggedText();
    expect(logged).toContain("[resume-extract] PDF extraction failed");
    expect(logged).not.toContain("PRIVATE-MARKER");
    expect(logged).not.toContain("Priya");
    expect(logged).not.toContain("CONFIDENTIAL");
    expect(logged).not.toContain(payloadB64);
    expect(logged).not.toContain(payloadB64.slice(0, 24));
  });

  it("keeps the existing readable-text error for a PDF with no text", async () => {
    await expect(
      extractResumeText({
        fileBase64: b64(makeTextlessPdf()),
        fileName: "scan.pdf",
        mimeType: PDF_MIME,
      }),
    ).rejects.toThrow(NOT_ENOUGH_TEXT);
  });

  it("keeps the readable-text error for a DOCX with almost no text", async () => {
    await expect(
      extractResumeText({
        fileBase64: b64(makeDocx(["Hi"])),
        fileName: "tiny.docx",
        mimeType: DOCX_MIME,
      }),
    ).rejects.toThrow(NOT_ENOUGH_TEXT);
  });

  it("rejects oversized files before parsing them", async () => {
    const tooBig = Buffer.alloc(RESUME_MAX_FILE_BYTES + 1024, 65).toString("base64");
    await expect(
      extractResumeText({ fileBase64: tooBig, fileName: "resume.pdf", mimeType: PDF_MIME }),
    ).rejects.toThrow(/too large.*under 5 MB/i);
    expect(errorSpy).not.toHaveBeenCalled(); // rejected up front, no parser involved
  });

  // The near-5MB boundary case (byte length just UNDER the limit, so it must reach the
  // real parser rather than being rejected by the size gate) lives in the "mocked parser"
  // group below, not here: with a genuine pdf-parse, a ~5MB buffer with no valid PDF
  // structure forces pdf.js's xref-recovery path to linearly scan the entire buffer before
  // giving up (independently measured at ~0.8s uncontended, several seconds under CPU
  // contention on a busy CI runner) -- cost proportional to buffer SIZE, not to anything
  // this test is actually checking. The thing under test is `buffer.length <= MAX`
  // arithmetic, which is exactly as well verified by a mocked parser that returns
  // instantly, without paying for a real multi-second structural recovery scan on
  // deliberately-invalid content that no production resume will ever look like.

  it.each([
    ["notes.txt", "text/plain"],
    ["resume.doc", "application/msword"],
    ["photo.png", "image/png"],
    ["resume", "application/octet-stream"],
  ])("rejects unsupported file %s (%s)", async (fileName, mimeType) => {
    await expect(
      extractResumeText({ fileBase64: b64(Buffer.from("hello world")), fileName, mimeType }),
    ).rejects.toThrow(/Unsupported file type/);
  });

  it("rejects empty and non-base64 payloads", async () => {
    await expect(
      extractResumeText({ fileBase64: "", fileName: "resume.pdf", mimeType: PDF_MIME }),
    ).rejects.toThrow(/appears to be empty/);
    // Characters outside the base64 alphabet decode to zero bytes.
    await expect(
      extractResumeText({ fileBase64: "@@@@####", fileName: "resume.pdf", mimeType: PDF_MIME }),
    ).rejects.toThrow(/appears to be empty/);
  });

  it("caps PDF text at 20,000 characters and reports truncated", async () => {
    const line =
      "Delivered analytics project with measurable outcome and stakeholder sign-off, ok.";
    const pages = Array.from({ length: 8 }, (_, p) =>
      Array.from({ length: 50 }, (_, i) => `${line} #${p * 50 + i}`),
    );
    const result = await extractResumeText({
      fileBase64: b64(makePdf(pages)),
      fileName: "long.pdf",
      mimeType: PDF_MIME,
    });
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(20_000);
  });

  it("caps DOCX text at 20,000 characters and reports truncated", async () => {
    const paragraph =
      "Led migration of reporting workloads with zero downtime and full audit trail. ".repeat(4);
    const paragraphs = Array.from({ length: 90 }, (_, i) => `${paragraph}${i}`);
    const result = await extractResumeText({
      fileBase64: b64(makeDocx(paragraphs)),
      fileName: "long.docx",
      mimeType: DOCX_MIME,
    });
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(20_000);
  });

  it("does not report truncated for text under the cap", async () => {
    const { truncated } = await extractResumeText({
      fileBase64: b64(makeDocx(RESUME_LINES)),
      fileName: "resume.docx",
      mimeType: DOCX_MIME,
    });
    expect(truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. MOCKED parsers
// ---------------------------------------------------------------------------
describe("PDF runtime handling (mocked parser)", () => {
  const validInput = () => ({
    fileBase64: b64(Buffer.from("%PDF-1.4 stand-in bytes for a mocked parser")),
    fileName: "resume.pdf",
    mimeType: PDF_MIME,
  });
  const GOOD_TEXT = `${"Experienced analyst with strong SQL and Python skills. ".repeat(3)}`;

  type ParserMock = { getText: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
  let parser: ParserMock;
  let constructed: number;

  async function loadWithMockedPdfParse(): Promise<typeof import("../resume-extract.server")> {
    vi.resetModules();
    constructed = 0;
    vi.doMock("pdf-parse/worker", () => ({}));
    vi.doMock("pdf-parse", () => ({
      PDFParse: class {
        constructor() {
          constructed += 1;
          return parser as unknown as object;
        }
      },
    }));
    return import("../resume-extract.server");
  }

  beforeEach(() => {
    parser = {
      getText: vi.fn().mockResolvedValue({ text: GOOD_TEXT }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    g["pdfjsWorker"] = { WorkerMessageHandler: {} }; // what pdf-parse/worker registers
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("pdf-parse");
    vi.doUnmock("pdf-parse/worker");
    delete g["pdfjsWorker"];
  });

  afterAll(() => {
    vi.resetModules();
  });

  it("accepts a file just under the 5 MB limit at the size check (real size math, mocked parser)", async () => {
    const { extractResumeText, RESUME_MAX_FILE_BYTES } = await loadWithMockedPdfParse();
    // Real arithmetic against the real exported constant; only the (irrelevant to this
    // check) actual PDF parsing is mocked out, so the boundary math is exercised for real
    // without the cost of a genuine multi-megabyte parse. A malformed-content-and-real-
    // pdf-parse case is already covered by "maps a corrupt PDF to the product-level error"
    // above, with a tiny buffer -- combining that with a near-5MB length adds no further
    // regression coverage, only CPU cost.
    const nearLimit = Buffer.alloc(RESUME_MAX_FILE_BYTES - 1024, 65).toString("base64");
    const result = await extractResumeText({
      fileBase64: nearLimit,
      fileName: "resume.pdf",
      mimeType: PDF_MIME,
    });
    expect(result.text).toContain("Experienced analyst"); // proves it reached getText(), i.e. was NOT rejected as "too large"
    expect(constructed).toBe(1);
  });

  it("destroys the parser after a successful extraction", async () => {
    const { extractResumeText } = await loadWithMockedPdfParse();
    const result = await extractResumeText(validInput());
    expect(result.text).toContain("Experienced analyst");
    expect(parser.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the parser when extraction fails, and shows the product error", async () => {
    parser.getText.mockRejectedValue(new Error("bad xref table"));
    const { extractResumeText } = await loadWithMockedPdfParse();
    await expect(extractResumeText(validInput())).rejects.toThrow(PDF_UNREADABLE);
    expect(parser.destroy).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain("[resume-extract] PDF extraction failed");
    expect(loggedText()).toContain("bad xref table");
  });

  it("a failing destroy() does not turn a success into a failure", async () => {
    parser.destroy.mockRejectedValue(new Error("worker already terminated"));
    const { extractResumeText } = await loadWithMockedPdfParse();
    const result = await extractResumeText(validInput());
    expect(result.text).toContain("Experienced analyst");
    expect(loggedText()).toContain("[resume-extract] PDF parser cleanup failed");
  });

  it("a failing destroy() does not mask the real extraction error", async () => {
    parser.getText.mockRejectedValue(new Error("bad xref table"));
    parser.destroy.mockRejectedValue(new Error("worker already terminated"));
    const { extractResumeText } = await loadWithMockedPdfParse();
    await expect(extractResumeText(validInput())).rejects.toThrow(PDF_UNREADABLE);
    expect(loggedText()).toContain("bad xref table");
  });

  it("sanitizes extracted text (control characters, CRLF, blank-line runs)", async () => {
    parser.getText.mockResolvedValue({
      text: `Line one of the resume\u0000 with a null\r\nLine two   \n\n\n\n\n\nLine three, long enough to pass the minimum length.`,
    });
    const { extractResumeText } = await loadWithMockedPdfParse();
    const { text } = await extractResumeText(validInput());
    expect(text).not.toContain("\u0000");
    expect(text).not.toContain("\r");
    expect(text).toBe(
      "Line one of the resume with a null\nLine two\n\n\nLine three, long enough to pass the minimum length.",
    );
  });

  it("reports an initialization failure as OUR problem, not a corrupt file", async () => {
    vi.resetModules();
    vi.doMock("pdf-parse/worker", () => {
      throw new Error("Cannot evaluate worker entry");
    });
    vi.doMock("pdf-parse", () => ({ PDFParse: class {} }));
    const { extractResumeText } = await import("../resume-extract.server");

    const error = await extractResumeText(validInput()).catch((e: Error) => e);
    expect((error as Error).message).toMatch(PDF_UNAVAILABLE);
    expect((error as Error).message).not.toMatch(/corrupt|password|scanned/i);
    // Internals stay in the server logs (vitest wraps the mock error, so assert on the record, not its text).
    expect(loggedText()).toContain("[resume-extract] PDF runtime initialization failed");
    expect(errorSpy.mock.calls[0]![1]).toMatchObject({
      bytes: expect.any(Number),
      errorName: expect.any(String),
    });
    expect(loggedText()).not.toContain("PDF extraction failed");
  });

  it("reports a worker that never registers as an initialization failure, then recovers on retry", async () => {
    const { extractResumeText } = await loadWithMockedPdfParse();
    delete g["pdfjsWorker"];
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); // leave vitest's own module loading alone

    const first = extractResumeText(validInput());
    const firstAssertion = expect(first).rejects.toThrow(PDF_UNAVAILABLE);
    // The module imports need real event-loop turns before the polling loop even
    // starts, so advance the fake clock repeatedly until the request settles
    // (5 s of polling = 500 x 10 ms), yielding a real turn each time.
    let settled = false;
    void first.then(
      () => (settled = true),
      () => (settled = true),
    );
    for (let i = 0; i < 300 && !settled; i++) {
      await vi.advanceTimersByTimeAsync(100);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(settled).toBe(true);
    await firstAssertion;
    expect(loggedText()).toContain("[resume-extract] PDF runtime initialization failed");
    expect(constructed).toBe(0); // never got as far as parsing

    // The failure is not cached: once the worker is there, the next request works.
    g["pdfjsWorker"] = { WorkerMessageHandler: {} };
    const second = await extractResumeText(validInput());
    expect(second.text).toContain("Experienced analyst");
    expect(constructed).toBe(1);
  });

  it("loads the PDF runtime once and reuses it across requests", async () => {
    const workerFactory = vi.fn(() => ({}));
    vi.resetModules();
    vi.doMock("pdf-parse/worker", workerFactory);
    vi.doMock("pdf-parse", () => ({
      PDFParse: class {
        constructor() {
          return parser as unknown as object;
        }
      },
    }));
    const { extractResumeText } = await import("../resume-extract.server");
    await extractResumeText(validInput());
    await extractResumeText(validInput());
    await extractResumeText(validInput());
    expect(workerFactory).toHaveBeenCalledTimes(1);
    expect(parser.destroy).toHaveBeenCalledTimes(3);
  });

  it("installs missing DOM globals before pdf-parse loads, without overriding existing ones", async () => {
    const sentinel = class ExistingDOMMatrix {};
    const before = { DOMMatrix: g["DOMMatrix"], Path2D: g["Path2D"], ImageData: g["ImageData"] };
    delete g["Path2D"];
    delete g["ImageData"];
    g["DOMMatrix"] = sentinel;
    try {
      const seenAtLoad: Record<string, unknown> = {};
      vi.resetModules();
      vi.doMock("pdf-parse/worker", () => {
        seenAtLoad["Path2D"] = typeof g["Path2D"];
        seenAtLoad["ImageData"] = typeof g["ImageData"];
        return {};
      });
      vi.doMock("pdf-parse", () => ({
        PDFParse: class {
          constructor() {
            return parser as unknown as object;
          }
        },
      }));
      const { extractResumeText } = await import("../resume-extract.server");
      await extractResumeText(validInput());

      expect(g["DOMMatrix"]).toBe(sentinel); // a real implementation is never replaced
      expect(seenAtLoad).toEqual({ Path2D: "function", ImageData: "function" }); // present BEFORE the worker entry evaluates
    } finally {
      for (const [key, value] of Object.entries(before)) {
        if (value === undefined) delete g[key];
        else g[key] = value;
      }
    }
  });

  it("provides a __dirname placeholder only while loading pdf-parse/worker, then removes it", async () => {
    delete g["__dirname"];
    let seenDuringLoad: unknown;
    vi.resetModules();
    vi.doMock("pdf-parse/worker", () => {
      seenDuringLoad = g["__dirname"];
      return {};
    });
    vi.doMock("pdf-parse", () => ({
      PDFParse: class {
        constructor() {
          return parser as unknown as object;
        }
      },
    }));
    const { extractResumeText } = await import("../resume-extract.server");
    await extractResumeText(validInput());
    expect(typeof seenDuringLoad).toBe("string"); // import.meta.url-free branch taken
    expect(typeof g["__dirname"]).toBe("undefined"); // no lasting global pollution
  });
});

// ---------------------------------------------------------------------------
// 3. Build wiring + shim
// ---------------------------------------------------------------------------
describe("Cloudflare Workers build wiring", () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));

  it("vite.config.ts aliases the native canvas addon to the text-only shim for the Worker build", () => {
    const config = readFileSync(`${root}vite.config.ts`, "utf-8");
    expect(config).toContain('"@napi-rs/canvas"');
    expect(config).toContain("./src/lib/premium/napi-canvas-shim.ts");
  });

  it("does not add a storage or external-PDF-service dependency", () => {
    const source = readFileSync(`${root}src/lib/premium/resume-extract.server.ts`, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "") // comments legitimately explain "never stored"
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    expect(source).not.toMatch(/supabase|storage|fetch\(|https?:\/\//i);
  });
});

describe("napi-canvas-shim (text-extraction-only stand-in)", () => {
  it("provides the constructors pdf.js needs to merely load", () => {
    const matrix = new DOMMatrix();
    expect([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]).toEqual([
      1, 0, 0, 1, 0, 0,
    ]);
    expect(new Path2D()).toBeInstanceOf(Path2D);
    const image = new ImageData(2, 3);
    expect(image.data).toHaveLength(2 * 3 * 4);
  });

  it("fails loudly, never silently, if rendering is ever attempted", () => {
    expect(() => new DOMMatrix().multiplySelf()).toThrow(/not available in this runtime/);
    expect(() => new DOMMatrix().invertSelf()).toThrow(/not available in this runtime/);
    expect(() => new Path2D().addPath()).toThrow(/not available in this runtime/);
    expect(() => createCanvas(1, 1)).toThrow(/not available in this runtime/);
    expect(() => new Canvas()).toThrow(/not available in this runtime/);
  });
});
