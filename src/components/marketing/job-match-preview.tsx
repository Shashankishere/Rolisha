import { CheckCircle2, MapPin } from "lucide-react";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";

/**
 * A structural mockup of the in-app job-match card — same layout the real
 * dashboard uses, but explicitly labeled as illustrative so it can never be
 * mistaken for a real posting. No invented company, salary, or location:
 * that's the whole point of showing "structure, not data" here.
 */
export function JobMatchPreview() {
  const skills = [
    { name: "SQL", matched: true },
    { name: "Excel", matched: true },
    { name: "Python", matched: true },
    { name: "Power BI", matched: false },
    { name: "Statistics", matched: false },
  ];

  return (
    <InstrumentFrame label="Job match: illustrative" status="SAMPLE">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-base font-semibold">Data Analyst</p>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              <MapPin className="size-3" />
              Company and location shown per real posting — none fabricated here
            </p>
          </div>
          <div className="border-primary/30 bg-primary-soft text-primary shrink-0 rounded-full border px-3 py-1 text-center">
            <p className="font-display text-lg leading-none font-bold">78%</p>
            <p className="text-[9px] tracking-wide uppercase">match</p>
          </div>
        </div>

        <div className="border-border/60 mt-5 border-t pt-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Why this matches
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <li
                key={s.name}
                className={
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs " +
                  (s.matched ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")
                }
              >
                {s.matched && <CheckCircle2 className="size-3" />}
                {s.name}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-muted-foreground mt-4 text-xs italic">
          Real postings show real salary when the source provides it, or say so plainly when it
          doesn't — never a guessed number.
        </p>
      </div>
    </InstrumentFrame>
  );
}
