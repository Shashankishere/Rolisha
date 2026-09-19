import { useCallback, useRef, useState } from "react";
import { AlertTriangle, File as FileIcon, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractResumeFile } from "@/lib/premium/resume-extract.functions";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — kept in sync with resume-extract.server.ts
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix.
      const commaIndex = result.indexOf(",");
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

type UploadState =
  | { phase: "idle" }
  | { phase: "processing"; fileName: string; fileSize: number }
  | { phase: "done"; fileName: string; fileSize: number; truncated: boolean }
  | { phase: "error"; fileName: string | null; fileSize: number | null; message: string };

export function ResumeUpload({
  onExtracted,
  disabled,
}: {
  onExtracted: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!hasAcceptedExtension(file.name) || !ACCEPTED_MIME_TYPES.includes(file.type)) {
        // Some browsers report an empty/odd MIME type for docx, so only
        // reject on MIME type when the extension is also wrong.
        if (!hasAcceptedExtension(file.name)) {
          setState({
            phase: "error",
            fileName: file.name,
            fileSize: file.size,
            message: "Unsupported file type. Please upload a PDF or DOCX file.",
          });
          return;
        }
      }

      if (file.size > MAX_FILE_BYTES) {
        setState({
          phase: "error",
          fileName: file.name,
          fileSize: file.size,
          message: `That file is too large (${formatFileSize(file.size)}). Max size is 5 MB.`,
        });
        return;
      }

      setState({ phase: "processing", fileName: file.name, fileSize: file.size });

      try {
        const fileBase64 = await fileToBase64(file);
        const result = await extractResumeFile({
          data: { fileBase64, fileName: file.name, mimeType: file.type },
        });
        setState({
          phase: "done",
          fileName: file.name,
          fileSize: file.size,
          truncated: result.truncated,
        });
        onExtracted(result.text);
      } catch (error) {
        setState({
          phase: "error",
          fileName: file.name,
          fileSize: file.size,
          message:
            error instanceof Error
              ? error.message
              : "Could not read this resume. Please try another file.",
        });
      }
    },
    [onExtracted],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (file) void processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function reset() {
    setState({ phase: "idle" });
    onExtracted("");
  }

  const isBusy = state.phase === "processing";

  return (
    <div className="space-y-2">
      {state.phase === "idle" || state.phase === "error" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " +
            (isDragging
              ? "border-primary bg-primary-soft/40"
              : "border-border/70 hover:border-primary/40")
          }
        >
          <div className="bg-muted grid size-10 place-items-center rounded-full">
            <UploadCloud className="text-muted-foreground size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Upload your resume</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Upload your existing resume and let AI analyze it automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
          <p className="text-muted-foreground text-[11px]">
            Accepted formats: PDF, DOCX · Max size 5 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={disabled}
            onChange={handleInputChange}
          />
          {state.phase === "error" && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mt-2 flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="border-border/70 flex items-center gap-3 rounded-xl border px-3 py-3">
          <div className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
            {isBusy ? (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            ) : (
              <FileIcon className="text-muted-foreground size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{state.fileName}</p>
            <p className="text-muted-foreground text-xs">
              {formatFileSize(state.fileSize)}
              {isBusy && " · Extracting text…"}
              {state.phase === "done" && " · Ready"}
              {state.phase === "done" && state.truncated && " (trimmed to fit)"}
            </p>
          </div>
          {!isBusy && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={disabled}
              onClick={reset}
              aria-label="Remove file"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
