import { AlertTriangle, Loader2 } from "lucide-react";
import { toUserFacingAiError } from "@/lib/ai/user-facing-error";

/**
 * Shown wherever a Pro AI generation is in flight or has failed.
 * Never silently swallowed and never replaced with fabricated content —
 * if `status` is "failed" the run's `errorMessage` is shown after being
 * mapped to product-level copy (raw validation/provider text is never shown), with a
 * retry action when the caller provides one.
 */
export function AiStatusNotice({
  status,
  errorMessage,
  onRetry,
  retryLabel = "Try again",
}: {
  status: "pending" | "failed";
  errorMessage?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (status === "pending") {
    return (
      <div className="panel flex items-center gap-3 p-6">
        <Loader2 className="text-muted-foreground size-5 shrink-0 animate-spin" />
        <p className="text-muted-foreground text-sm">Generating — this can take a few seconds…</p>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-3 p-6 sm:flex-row sm:items-start">
      <div className="bg-destructive/10 text-destructive grid size-9 shrink-0 place-items-center rounded-xl">
        <AlertTriangle className="size-4.5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">Couldn't generate this</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {/* Always product copy: rows stored before errors were humanized may hold raw internals. */}
          {toUserFacingAiError(errorMessage)}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="border-border hover:bg-muted shrink-0 self-start rounded-lg border px-3 py-1.5 text-sm font-medium"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
