import { Circle, CircleCheck } from "lucide-react";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";
import { TiltCard } from "@/components/app/tilt-card";

const TASKS = [
  { label: "Understand the dataset", done: true },
  { label: "Clean and prepare the data", done: true },
  { label: "Explore patterns", done: false },
  { label: "Build the dashboard", done: false },
  { label: "Write up insights", done: false },
];

/**
 * A structural mockup of the in-app project workspace — a real UI shape
 * (progress ring, task checklist, skill chips) with a placeholder project
 * name, so this reads as "what building a project here looks like," not as
 * a claim about a specific project someone actually completed.
 */
export function ProjectWorkspacePreview() {
  const doneCount = TASKS.filter((t) => t.done).length;
  const percent = Math.round((doneCount / TASKS.length) * 100);

  return (
    <TiltCard maxTilt={5}>
      <InstrumentFrame label="Project workspace: illustrative" status="SAMPLE">
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Sample project
              </p>
              <p className="font-display mt-0.5 truncate text-lg font-semibold">
                Customer Churn Analysis
              </p>
            </div>
            <div className="border-primary/30 relative size-14 shrink-0 rounded-full border-2">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3"
                  strokeDasharray={`${percent} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                {percent}%
              </span>
            </div>
          </div>

          <ol className="mt-5 space-y-2">
            {TASKS.map((task, i) => (
              <li key={task.label} className="flex items-center gap-2.5 text-sm">
                {task.done ? (
                  <CircleCheck className="text-success size-4 shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground/50 size-4 shrink-0" />
                )}
                <span
                  className={`min-w-0 truncate ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {String(i + 1).padStart(2, "0")} · {task.label}
                </span>
              </li>
            ))}
          </ol>

          <div className="border-border/60 mt-5 flex flex-wrap gap-1.5 border-t pt-4">
            {["SQL", "Python", "Statistics"].map((s) => (
              <span key={s} className="bg-muted rounded-full px-2.5 py-1 text-xs">
                {s}
              </span>
            ))}
          </div>
        </div>
      </InstrumentFrame>
    </TiltCard>
  );
}
