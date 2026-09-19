/**
 * Server-side logic for task workspace evidence (screenshots/files proving
 * a step was actually done). Complements the note/link fields already
 * handled in projects.server.ts — evidence is optional supporting proof,
 * never a substitute for the required written explanation, and never by
 * itself a way to mark a task complete.
 *
 * Files are stored in the private "task-evidence" Supabase Storage bucket
 * (see the 20260906000000_task_evidence migration) at
 *   {user_id}/{project_id}/{task_index}/{uuid}-{sanitized file name}
 * Storage RLS policies restrict every operation to the caller's own folder,
 * and `task_evidence` rows are scoped the same way at the table level —
 * defense in depth, not reliance on the application layer alone.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

import { loadTaskWorkspaceRow } from "@/lib/projects.server";

export class EvidenceValidationError extends Error {}

export const EVIDENCE_BUCKET = "task-evidence";

/** Generous enough for a full-page screenshot or a short project write-up,
 * small enough to keep uploads fast and storage costs predictable. */
export const EVIDENCE_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Caps a single task's evidence list to a browsable, intentional set of
 * proof rather than an unbounded dumping ground. */
export const EVIDENCE_MAX_FILES_PER_TASK = 5;

type EvidenceKind = "png" | "jpeg" | "webp" | "pdf" | "zip" | "docx" | "txt";

interface EvidenceTypeRule {
  kind: EvidenceKind;
  extensions: string[];
  mimeTypes: string[];
  /** Checks the file's actual leading bytes against its claimed type, so a
   * renamed/relabeled file can't sneak past extension+MIME checks alone.
   * Omitted for plain text, which has no reliable magic number. */
  matchesSignature?: (buf: Buffer) => boolean;
}

function bufferStartsWith(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

const EVIDENCE_TYPE_RULES: EvidenceTypeRule[] = [
  {
    kind: "png",
    extensions: [".png"],
    mimeTypes: ["image/png"],
    matchesSignature: (buf) =>
      bufferStartsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    kind: "jpeg",
    extensions: [".jpg", ".jpeg"],
    mimeTypes: ["image/jpeg"],
    matchesSignature: (buf) => bufferStartsWith(buf, [0xff, 0xd8, 0xff]),
  },
  {
    kind: "webp",
    extensions: [".webp"],
    mimeTypes: ["image/webp"],
    matchesSignature: (buf) =>
      bufferStartsWith(buf, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
      buf.length >= 12 &&
      buf.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    kind: "pdf",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    matchesSignature: (buf) => bufferStartsWith(buf, [0x25, 0x50, 0x44, 0x46]), // "%PDF"
  },
  {
    kind: "docx",
    extensions: [".docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    // .docx is a zip container — same signature family as .zip.
    matchesSignature: (buf) => bufferStartsWith(buf, [0x50, 0x4b]),
  },
  {
    kind: "zip",
    extensions: [".zip"],
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    matchesSignature: (buf) => bufferStartsWith(buf, [0x50, 0x4b]),
  },
  {
    kind: "txt",
    extensions: [".txt"],
    mimeTypes: ["text/plain"],
    // No reliable magic number for plain text; a null byte in the first
    // chunk is a reasonable "this isn't actually text" signal instead.
    matchesSignature: (buf) => !buf.subarray(0, Math.min(buf.length, 512)).includes(0x00),
  },
];

export const EVIDENCE_ACCEPTED_EXTENSIONS = EVIDENCE_TYPE_RULES.flatMap((r) => r.extensions);

function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

function bytesFromBase64Length(base64Length: number): number {
  return Math.floor((base64Length * 3) / 4);
}

/** Strips path separators and anything but a conservative safe-character
 * set, so the original file name can be used inside a storage path without
 * enabling traversal or weird characters breaking the URL. Display name
 * (shown to the user) keeps the original, untouched. */
function sanitizeForStoragePath(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, "");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(-140) || "file";
}

export interface TaskEvidenceRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  /** Short-lived signed URL for viewing/downloading — never a public URL. */
  viewUrl: string | null;
}

export interface UploadEvidenceInput {
  fileBase64: string;
  fileName: string;
  mimeType: string;
}

/**
 * Validates, decodes, and stores one evidence file for a task, then records
 * its metadata. Throws EvidenceValidationError for anything the user should
 * see as a clear, correctable message; throws a plain Error for
 * infrastructure failures.
 */
export async function uploadTaskEvidence(
  supabase: Client,
  userId: string,
  projectId: string,
  taskIndex: number,
  input: UploadEvidenceInput,
): Promise<TaskEvidenceRecord> {
  if (!input.fileBase64 || input.fileBase64.length === 0) {
    throw new EvidenceValidationError("The selected file appears to be empty.");
  }

  const approxBytes = bytesFromBase64Length(input.fileBase64.length);
  if (approxBytes > EVIDENCE_MAX_FILE_BYTES) {
    throw new EvidenceValidationError(
      `That file is too large. Max size is ${Math.floor(EVIDENCE_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const ext = extensionOf(input.fileName);
  const rule = EVIDENCE_TYPE_RULES.find(
    (r) => r.extensions.includes(ext) && r.mimeTypes.includes(input.mimeType),
  );
  if (!rule) {
    throw new EvidenceValidationError(
      "Unsupported file type. Upload a screenshot (PNG/JPG/WEBP), a PDF, or a DOCX/TXT/ZIP file.",
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.fileBase64, "base64");
  } catch {
    throw new EvidenceValidationError("Could not read this file. It may be corrupted.");
  }

  if (buffer.length === 0) {
    throw new EvidenceValidationError("The selected file appears to be empty.");
  }
  if (buffer.length > EVIDENCE_MAX_FILE_BYTES) {
    throw new EvidenceValidationError(
      `That file is too large. Max size is ${Math.floor(EVIDENCE_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
    );
  }

  if (rule.matchesSignature && !rule.matchesSignature(buffer)) {
    throw new EvidenceValidationError(
      "This file doesn't look like a valid " +
        rule.kind.toUpperCase() +
        " file. It may be corrupted or mislabeled.",
    );
  }

  const { existing, project } = await loadTaskWorkspaceRow(supabase, userId, projectId);
  const totalTasks: number = (project.requirements ?? []).length;
  if (taskIndex < 0 || taskIndex >= totalTasks) throw new Error("That step doesn't exist.");

  const completedTasks: number[] = (existing?.completed_tasks ?? []) as number[];
  if (completedTasks.includes(taskIndex)) {
    throw new EvidenceValidationError("This step is already completed and its evidence is locked.");
  }

  const { count, error: countError } = await supabase
    .from("task_evidence")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("task_index", taskIndex);
  if (countError) throw new Error("Unable to check existing evidence for this step.");
  if ((count ?? 0) >= EVIDENCE_MAX_FILES_PER_TASK) {
    throw new EvidenceValidationError(
      `You can attach up to ${EVIDENCE_MAX_FILES_PER_TASK} files per step. Remove one before adding another.`,
    );
  }

  const storagePath = `${userId}/${projectId}/${taskIndex}/${crypto.randomUUID()}-${sanitizeForStoragePath(input.fileName)}`;

  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, buffer, { contentType: input.mimeType, upsert: false });
  if (uploadError) throw new Error("Unable to upload this file. Please try again.");

  const { data: row, error: insertError } = await supabase
    .from("task_evidence")
    .insert({
      user_id: userId,
      project_id: projectId,
      task_index: taskIndex,
      storage_path: storagePath,
      file_name: input.fileName.slice(0, 255),
      file_size: buffer.length,
      mime_type: input.mimeType,
    })
    .select("id, file_name, file_size, mime_type, created_at")
    .single();

  if (insertError || !row) {
    // Best-effort cleanup so a failed metadata write doesn't leave an
    // orphaned, inaccessible-but-billed file behind.
    await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
    throw new Error("Unable to save this file's details. Please try again.");
  }

  const { data: signed } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 900);

  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    viewUrl: signed?.signedUrl ?? null,
  };
}

/**
 * Lists every task's evidence for a project in one query, with short-lived
 * signed view URLs batch-generated in a single Storage call. Used by
 * getProjectDetail so the workspace can render evidence cards without an
 * evidence-fetching round trip per task.
 */
export async function listProjectEvidenceByTask(
  supabase: Client,
  userId: string,
  projectId: string,
): Promise<Map<number, TaskEvidenceRecord[]>> {
  const { data: rows, error } = await supabase
    .from("task_evidence")
    .select("id, task_index, file_name, file_size, mime_type, storage_path, created_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load evidence for this project.");

  const evidenceRows = (rows ?? []) as any[];
  const byTask = new Map<number, TaskEvidenceRecord[]>();
  if (evidenceRows.length === 0) return byTask;

  const paths = evidenceRows.map((r) => r.storage_path as string);
  const { data: signedUrls } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrls(paths, 900);
  const urlByPath = new Map<string, string>(
    ((signedUrls ?? []) as any[])
      .filter((s) => !s.error && s.signedUrl)
      .map((s) => [s.path as string, s.signedUrl as string]),
  );

  for (const r of evidenceRows) {
    const list = byTask.get(r.task_index) ?? [];
    list.push({
      id: r.id,
      fileName: r.file_name,
      fileSize: r.file_size,
      mimeType: r.mime_type,
      createdAt: r.created_at,
      viewUrl: urlByPath.get(r.storage_path) ?? null,
    });
    byTask.set(r.task_index, list);
  }
  return byTask;
}

/**
 * Removes one evidence file — only while its task is still incomplete.
 * Once a task is submitted/completed, its evidence is locked (same rule as
 * the note/link fields in projects.server.ts).
 */
export async function removeTaskEvidence(
  supabase: Client,
  userId: string,
  projectId: string,
  taskIndex: number,
  evidenceId: string,
): Promise<{ ok: true }> {
  const { existing } = await loadTaskWorkspaceRow(supabase, userId, projectId);
  const completedTasks: number[] = (existing?.completed_tasks ?? []) as number[];
  if (completedTasks.includes(taskIndex)) {
    throw new EvidenceValidationError("This step is already completed and its evidence is locked.");
  }

  const { data: row, error: fetchError } = await supabase
    .from("task_evidence")
    .select("id, storage_path")
    .eq("id", evidenceId)
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("task_index", taskIndex)
    .maybeSingle();
  if (fetchError) throw new Error("Unable to find that file.");
  if (!row) throw new Error("That file was not found, or you don't have access to it.");

  const { error: deleteError } = await supabase
    .from("task_evidence")
    .delete()
    .eq("id", evidenceId)
    .eq("user_id", userId);
  if (deleteError) throw new Error("Unable to remove this file. Please try again.");

  // Storage cleanup happens after the DB row is gone, so a failure here
  // never leaves a file the UI still thinks exists.
  await supabase.storage.from(EVIDENCE_BUCKET).remove([(row as any).storage_path]);

  return { ok: true };
}
