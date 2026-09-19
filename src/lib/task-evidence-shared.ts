/**
 * Constants and pure helpers for task evidence uploads that are safe to
 * import from BOTH the browser (the upload widget) and the server
 * (task-evidence.server.ts) — no Buffer/crypto/Node APIs here. Keeping
 * these in one place is what makes the client-side pre-check and the
 * server-side validation agree, instead of drifting apart over time.
 *
 * The server performs additional checks a browser can't (file signature /
 * magic-number verification) — see task-evidence.server.ts. What's here is
 * the fast client-side filter plus the single source of truth for the
 * accepted type list shown in the UI.
 */

export const EVIDENCE_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — keep in sync with task-evidence.server.ts
export const EVIDENCE_MAX_FILES_PER_TASK = 5;

interface EvidenceTypeInfo {
  extensions: string[];
  mimeTypes: string[];
  label: string;
}

export const EVIDENCE_TYPES: EvidenceTypeInfo[] = [
  { extensions: [".png"], mimeTypes: ["image/png"], label: "PNG" },
  { extensions: [".jpg", ".jpeg"], mimeTypes: ["image/jpeg"], label: "JPG" },
  { extensions: [".webp"], mimeTypes: ["image/webp"], label: "WEBP" },
  { extensions: [".pdf"], mimeTypes: ["application/pdf"], label: "PDF" },
  {
    extensions: [".docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    label: "DOCX",
  },
  {
    extensions: [".zip"],
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    label: "ZIP",
  },
  { extensions: [".txt"], mimeTypes: ["text/plain"], label: "TXT" },
];

export const EVIDENCE_ACCEPTED_EXTENSIONS = EVIDENCE_TYPES.flatMap((t) => t.extensions);
export const EVIDENCE_ACCEPTED_MIME_TYPES = EVIDENCE_TYPES.flatMap((t) => t.mimeTypes);

/** The `accept` attribute value for the file input. */
export const EVIDENCE_INPUT_ACCEPT = [
  ...EVIDENCE_ACCEPTED_EXTENSIONS,
  ...EVIDENCE_ACCEPTED_MIME_TYPES,
].join(",");

/** Human-readable summary for helper text, e.g. "PNG, JPG, WEBP, PDF, DOCX, ZIP, TXT". */
export const EVIDENCE_TYPES_SUMMARY = EVIDENCE_TYPES.map((t) => t.label).join(", ");

export function evidenceExtensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

/** Fast client-side (and reusable server-side) extension+MIME check. This
 * is intentionally the same rule the server applies before it goes on to
 * check the file's actual bytes — see task-evidence.server.ts. */
export function isAcceptedEvidenceType(fileName: string, mimeType: string): boolean {
  const ext = evidenceExtensionOf(fileName);
  return EVIDENCE_TYPES.some((t) => t.extensions.includes(ext) && t.mimeTypes.includes(mimeType));
}

export function formatEvidenceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
