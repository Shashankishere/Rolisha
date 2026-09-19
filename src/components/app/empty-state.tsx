import type { ComponentType, ReactNode } from "react";
import { Reveal } from "@/components/app/reveal";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Use "error" for failed-to-load states — same layout, a subtle
   * destructive-tinted icon well instead of the neutral muted one. */
  tone?: "neutral" | "error";
}

/**
 * The shared empty/error-state layout used across dashboard, roadmap,
 * skills, projects, assessments, careers, jobs and admin: a soft icon
 * well, a bold one-line title, an optional muted description, and an
 * optional action — instead of every page inventing its own spacing and
 * icon size. Wrapped in Reveal so these states fade in consistently
 * with the rest of the product's motion language.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "neutral",
}: EmptyStateProps) {
  return (
    <Reveal>
      <div
        className={cn(
          "panel hover-lift flex flex-col items-center gap-3 p-10 text-center",
          className,
        )}
      >
        <div
          className={cn(
            "grid size-14 place-items-center rounded-2xl",
            tone === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary-soft text-primary",
          )}
        >
          <Icon className="size-6" />
        </div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </Reveal>
  );
}
