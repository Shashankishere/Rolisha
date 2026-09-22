import { Check } from "lucide-react";
import { ReadinessRing } from "@/components/dashboard/readiness-ring";

const PREVIEW_SKILLS = [
  { name: "Excel", value: 100 },
  { name: "Python", value: 60 },
  { name: "SQL", value: 20 },
  { name: "Statistics", value: 10 },
  { name: "Power BI", value: 0 },
];

/** Illustrative product preview used on the marketing site only. */
export function DashboardPreview() {
  return (
    <div className="panel relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Target role
          </p>
          <p className="font-display text-xl font-semibold">Data Analyst</p>
        </div>
        <ReadinessRing value={42} size={92} label="Readiness" />
      </div>

      <ul className="mt-6 space-y-3">
        {PREVIEW_SKILLS.map((skill) => (
          <li key={skill.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
            <span className="truncate text-sm font-medium">{skill.name}</span>
            <span className="bg-muted h-2 overflow-hidden rounded-full">
              <span
                className="bg-brand-gradient block h-full rounded-full"
                style={{ width: `${Math.max(skill.value, 2)}%` }}
              />
            </span>
            <span className="text-muted-foreground text-right text-xs tabular-nums">
              {skill.value === 100 ? (
                <Check className="text-success ml-auto size-4" />
              ) : (
                `${skill.value}%`
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground border-border/70 mt-6 border-t pt-4 text-xs">
        Illustrative preview. In the product this panel is calculated from the job postings stored
        in your workspace and is always labelled with its data mode.
      </p>
    </div>
  );
}
