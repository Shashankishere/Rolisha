import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The site's recurring signature device: a thin instrument-panel frame with
 * corner tick marks and a small readout label, used to wrap every
 * data/3D visualization across the marketing site (hero engine, skill
 * constellation, career journey, project preview).
 *
 * The label + status readout live in a normal flex header row (not
 * absolutely-positioned corner text) so they can never overlap each other
 * or get cut off by an overflow boundary at narrow widths — they share
 * space and truncate individually instead of colliding.
 */
export function InstrumentFrame({
  label,
  status = "LIVE",
  className,
  children,
}: {
  /** Omit to render the frame without its readout header row. */
  label?: string;
  status?: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-surface/60 text-foreground relative overflow-hidden rounded-2xl border backdrop-blur-sm",
        className,
      )}
    >
      {/* corner ticks — decorative only, sized to never intrude on content */}
      {(
        [
          "top-2 left-2 border-t border-l",
          "top-2 right-2 border-t border-r",
          "bottom-2 left-2 border-b border-l",
          "bottom-2 right-2 border-b border-r",
        ] as const
      ).map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cn("border-border/70 pointer-events-none absolute size-2.5", pos)}
        />
      ))}

      {label && (
        <div className="bg-surface/95 text-muted-foreground/70 relative z-10 flex items-center justify-between gap-3 px-4 pt-3 pb-2 font-mono text-[10px] tracking-widest uppercase">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="bg-primary size-1.5 shrink-0 animate-pulse rounded-full" aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0">{status}</span>
        </div>
      )}

      <div className="relative z-0">{children}</div>
    </div>
  );
}
