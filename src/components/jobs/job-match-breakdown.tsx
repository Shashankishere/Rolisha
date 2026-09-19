import { AlertTriangle, Check } from "lucide-react";
import type { MatchBreakdown } from "@/lib/domain";
import type { JobSkillRef } from "@/lib/jobs/explorer-types";

const ROWS: {
  key: keyof Pick<MatchBreakdown, "skills" | "experience" | "education" | "location" | "salary">;
  label: string;
}[] = [
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "location", label: "Location" },
  { key: "salary", label: "Salary" },
];

function barColor(score: number): string {
  if (score >= 80) return "bg-primary";
  if (score >= 50) return "bg-secondary-foreground/60";
  return "bg-muted-foreground/40";
}

export function JobMatchBreakdown({
  match,
  matchedSkills,
  missingSkills,
}: {
  match: MatchBreakdown;
  matchedSkills: JobSkillRef[];
  missingSkills: JobSkillRef[];
}) {
  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Why you&apos;re a good match</h2>
        <span className="text-2xl font-semibold tabular-nums">{match.overall}%</span>
      </div>

      <div className="mt-5 space-y-3">
        {ROWS.map((row) => (
          <div key={row.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">{match[row.key]}%</span>
            </div>
            <div className="bg-muted mt-1 h-2 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${barColor(match[row.key])}`}
                style={{ width: `${Math.min(100, Math.max(0, match[row.key]))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Matched skills
          </p>
          {matchedSkills.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">None yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {matchedSkills.map((s) => (
                <li
                  key={s.id}
                  className="bg-success-soft text-success inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                >
                  <Check className="size-3" /> {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Missing
          </p>
          {missingSkills.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">Nothing missing — great fit.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missingSkills.map((s) => (
                <li
                  key={s.id}
                  className="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                >
                  <AlertTriangle className="size-3" /> {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
