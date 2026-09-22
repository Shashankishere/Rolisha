import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  File as FileIcon,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { showMutationError } from "@/components/app/upgrade-prompt";
import { removeTaskEvidence, uploadTaskEvidence } from "@/lib/projects.functions";
import type { TaskEvidenceRecord } from "@/lib/task-evidence.server";
import {
  EVIDENCE_INPUT_ACCEPT,
  EVIDENCE_MAX_FILES_PER_TASK,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_TYPES_SUMMARY,
  formatEvidenceFileSize,
  isAcceptedEvidenceType,
} from "@/lib/task-evidence-shared";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** One in-flight or just-failed upload, tracked client-side only until it
 * either lands in `evidence` (server-confirmed) or is dismissed. */
interface PendingUpload {
  key: string;
  fileName: string;
  fileSize: number;
  phase: "uploading" | "error";
  message?: string;
}

export function TaskEvidenceUpload({
  projectId,
  taskIndex,
  evidence,
  locked,
}: {
  projectId: string;
  taskIndex: number;
  evidence: TaskEvidenceRecord[];
  locked: boolean;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const uploadMutation = useMutation({
    mutationFn: (vars: { fileBase64: string; fileName: string; mimeType: string }) =>
      uploadTaskEvidence({ data: { projectId, taskIndex, ...vars } }),
  });

  const removeMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      removeTaskEvidence({ data: { projectId, taskIndex, evidenceId } }),
    onSuccess: invalidate,
    onError: (error: Error) => showMutationError(error, "Could not remove this file."),
  });

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const roomLeft = EVIDENCE_MAX_FILES_PER_TASK - evidence.length - pending.length;
      const toProcess = fileArray.slice(0, Math.max(roomLeft, 0));
      const overflow = fileArray.length - toProcess.length;

      if (overflow > 0) {
        setPending((prev) => [
          ...prev,
          {
            key: `overflow-${Date.now()}`,
            fileName: `${overflow} more file${overflow === 1 ? "" : "s"}`,
            fileSize: 0,
            phase: "error",
            message: `You can attach up to ${EVIDENCE_MAX_FILES_PER_TASK} files per step.`,
          },
        ]);
      }

      for (const file of toProcess) {
        const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;

        if (!isAcceptedEvidenceType(file.name, file.type)) {
          setPending((prev) => [
            ...prev,
            {
              key,
              fileName: file.name,
              fileSize: file.size,
              phase: "error",
              message: `Unsupported file type. Accepted: ${EVIDENCE_TYPES_SUMMARY}.`,
            },
          ]);
          continue;
        }

        if (file.size > EVIDENCE_MAX_FILE_BYTES) {
          setPending((prev) => [
            ...prev,
            {
              key,
              fileName: file.name,
              fileSize: file.size,
              phase: "error",
              message: `That file is too large (${formatEvidenceFileSize(file.size)}). Max size is ${Math.floor(EVIDENCE_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
            },
          ]);
          continue;
        }

        setPending((prev) => [
          ...prev,
          { key, fileName: file.name, fileSize: file.size, phase: "uploading" },
        ]);

        try {
          const fileBase64 = await fileToBase64(file);
          await uploadMutation.mutateAsync({
            fileBase64,
            fileName: file.name,
            mimeType: file.type,
          });
          setPending((prev) => prev.filter((p) => p.key !== key));
          invalidate();
        } catch (error) {
          setPending((prev) =>
            prev.map((p) =>
              p.key === key
                ? {
                    ...p,
                    phase: "error",
                    message:
                      error instanceof Error ? error.message : "Upload failed. Please try again.",
                  }
                : p,
            ),
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [evidence.length, pending.length],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (files && files.length > 0) void processFiles(files);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (locked) return;
    if (e.dataTransfer.files.length > 0) void processFiles(e.dataTransfer.files);
  }

  function dismissPending(key: string) {
    setPending((prev) => prev.filter((p) => p.key !== key));
  }

  const atCapacity =
    evidence.length + pending.filter((p) => p.phase === "uploading").length >=
    EVIDENCE_MAX_FILES_PER_TASK;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Upload evidence</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Attach screenshots, documents, or other evidence showing the work you completed.
        </p>
      </div>

      {!locked && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!atCapacity) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors " +
            (atCapacity
              ? "border-border/50 opacity-60"
              : isDragging
                ? "border-primary bg-primary-soft/40"
                : "border-border/70 hover:border-primary/40")
          }
        >
          <div className="bg-muted grid size-9 place-items-center rounded-full">
            <UploadCloud className="text-muted-foreground size-4" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atCapacity}
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
          <p className="text-muted-foreground text-[11px]">
            {atCapacity
              ? `Maximum of ${EVIDENCE_MAX_FILES_PER_TASK} files reached`
              : `${EVIDENCE_TYPES_SUMMARY} · Max ${Math.floor(EVIDENCE_MAX_FILE_BYTES / (1024 * 1024))} MB · Up to ${EVIDENCE_MAX_FILES_PER_TASK} files`}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={EVIDENCE_INPUT_ACCEPT}
            className="hidden"
            disabled={atCapacity}
            onChange={handleInputChange}
          />
        </div>
      )}

      {(evidence.length > 0 || pending.length > 0) && (
        <ul className="space-y-2">
          {evidence.map((item) => {
            const isImage = item.mimeType.startsWith("image/");
            return (
              <li
                key={item.id}
                className="border-border/70 flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                {isImage && item.viewUrl ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(item.viewUrl)}
                    className="bg-muted group relative size-9 shrink-0 overflow-hidden rounded-lg"
                    aria-label={`Enlarge ${item.fileName}`}
                  >
                    <img
                      src={item.viewUrl}
                      alt={item.fileName}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                      <ZoomIn className="size-4 text-white" />
                    </span>
                  </button>
                ) : (
                  <div className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
                    {item.mimeType === "application/pdf" ? (
                      <FileText className="text-muted-foreground size-4" />
                    ) : (
                      <FileIcon className="text-muted-foreground size-4" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatEvidenceFileSize(item.fileSize)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.viewUrl && (
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <a href={item.viewUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </Button>
                  )}
                  {!locked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(item.id)}
                      aria-label={`Remove ${item.fileName}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}

          {pending.map((item) => (
            <li
              key={item.key}
              className={
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 " +
                (item.phase === "error"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border/70")
              }
            >
              <div className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
                {item.phase === "uploading" ? (
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                ) : (
                  <AlertTriangle className="text-destructive size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                <p
                  className={
                    item.phase === "error"
                      ? "text-destructive text-xs"
                      : "text-muted-foreground text-xs"
                  }
                >
                  {item.phase === "uploading"
                    ? `${formatEvidenceFileSize(item.fileSize)} · Uploading…`
                    : item.message}
                </p>
              </div>
              {item.phase === "error" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => dismissPending(item.key)}
                  aria-label="Dismiss"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">Evidence preview</DialogTitle>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Evidence preview"
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
