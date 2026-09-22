import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, ClipboardCheck, FolderGit2, GraduationCap, Target } from "lucide-react";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";

const STEPS = [
  {
    label: "Choose",
    icon: Target,
    title: "Choose your target role",
    body: "Pick from real career paths — Data Analyst, Frontend Developer, Backend Developer and more — each with its own required skills and salary range.",
  },
  {
    label: "Assess",
    icon: ClipboardCheck,
    title: "Assess your current skills",
    body: "See exactly where you stand against that role's requirements, skill by skill, with an honest gap percentage — not a guess.",
  },
  {
    label: "Learn",
    icon: GraduationCap,
    title: "Learn the required skills",
    body: "Work through real lessons, examples and practice for each skill you're missing, at your own pace.",
  },
  {
    label: "Build",
    icon: FolderGit2,
    title: "Build real projects",
    body: "Apply what you've learned to portfolio ready projects with a clear objective, step by step tasks, and resources for each step.",
  },
  {
    label: "Get hired",
    icon: BriefcaseBusiness,
    title: "Become job ready and find relevant jobs",
    body: "Track your readiness score as it climbs, then match against real job postings scored against your actual skill profile.",
  },
] as const;

/**
 * A visually prominent, full career-journey composition. Title + description
 * are ALWAYS visible under every stage (not hover-gated) so the section reads
 * completely at a glance; hover/focus is reserved for emphasis (elevation,
 * icon reaction, connector glow), never for revealing content. Desktop shows
 * a wide CSS-3D path with five numbered nodes each above their own text
 * column so nothing clips or overlaps its neighbors. Mobile gets a proper
 * vertical timeline, not a shrunk desktop layout.
 */
export function CareerJourneySection() {
  const [hovered, setHovered] = useState<number | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pathLength, setPathLength] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);

  // Measure the connector path once so the "draw on scroll" reveal traces
  // its exact length rather than an approximated constant.
  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  // Trigger the draw-in once the journey scrolls into view. A CSS
  // transition (not the keyframe animation) drives it, so it automatically
  // collapses to ~instant under the global prefers-reduced-motion rule.
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setDrawn(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="border-border/70 bg-halo bg-dot-grid border-b px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-primary text-sm font-semibold tracking-wide uppercase">
          The Rolisha path
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold text-balance sm:text-4xl lg:text-5xl">
          One connected journey, not five disconnected tools
        </h2>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base text-pretty sm:text-lg">
          Rolisha isn't a course library or a job board bolted onto a resume tool — it's one
          connected journey from "I don't know where to start" to "I'm applying with confidence."
        </p>
      </div>

      {/* Desktop / tablet: wide horizontal path with numbered nodes, each with
          its own always-visible title + description column beneath it. */}
      <div className="mx-auto mt-16 hidden max-w-6xl md:block">
        {/* Heading readout intentionally omitted here — the diagram, its
            stages, animations, and interactions are unchanged; only the
            "Career journey" / "5 STAGES" label row above it was removed. */}
        <InstrumentFrame className="px-6 pt-8 pb-10">
          <div className="[perspective:1400px]" ref={frameRef}>
            <div className="relative [transform-style:preserve-3d] [transform:rotateX(6deg)]">
              <svg
                viewBox="0 0 1000 120"
                className="text-border w-full"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M 40 90 C 200 10, 320 10, 500 60 S 780 120, 960 30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="7 9"
                />
                <path
                  ref={pathRef}
                  d="M 40 90 C 200 10, 320 10, 500 60 S 780 120, 960 30"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity={hovered !== null ? 0.9 : 0.7}
                  style={{
                    strokeDasharray: pathLength ?? 1000,
                    strokeDashoffset: drawn ? 0 : (pathLength ?? 1000),
                    transition:
                      "stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
                  }}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 grid grid-cols-5">
                {STEPS.map((step, i) => {
                  const isHovered = hovered === i;
                  return (
                    <div
                      key={step.title}
                      className="animate-node-float pointer-events-auto flex flex-col items-center"
                      style={{
                        transform: `translateZ(${(i % 2) * 30}px)`,
                        animationDelay: `${i * 0.3}s`,
                      }}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(i)}
                        onBlur={() => setHovered(null)}
                        aria-describedby={`career-stage-${i}-desc`}
                        className={
                          "panel bg-card text-primary relative flex size-14 items-center justify-center rounded-2xl transition-all duration-300 " +
                          (isHovered
                            ? "shadow-glow border-primary/50 [transform:scale(1.25)_rotateY(-8deg)_rotateX(6deg)]"
                            : "shadow-lift scale-100")
                        }
                      >
                        <step.icon className="size-6" />
                        <span className="bg-primary text-primary-foreground absolute -top-2.5 -right-2.5 flex size-6 items-center justify-center rounded-full text-xs font-bold">
                          {i + 1}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Always-visible content row: one column per stage, same width as
              the node grid above, so text never overlaps a neighbor. */}
          <div className="mt-10 grid grid-cols-5 gap-4">
            {STEPS.map((step, i) => {
              const isHovered = hovered === i;
              return (
                <div
                  key={step.title}
                  id={`career-stage-${i}-desc`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className={
                    "rounded-xl border border-transparent p-3 text-center transition-all duration-300 " +
                    (isHovered ? "border-border/70 bg-popover shadow-lift -translate-y-0.5" : "")
                  }
                >
                  <p
                    className={
                      "font-display text-xs font-semibold tracking-wide uppercase transition-colors " +
                      (isHovered ? "text-primary" : "text-muted-foreground")
                    }
                  >
                    {String(i + 1).padStart(2, "0")} — {step.label}
                  </p>
                  <p className="text-foreground mt-2 text-sm leading-snug font-medium text-balance">
                    {step.title}
                  </p>
                  <p
                    className={
                      "text-muted-foreground mt-1.5 text-xs leading-relaxed text-pretty transition-opacity " +
                      (isHovered ? "opacity-100" : "opacity-80")
                    }
                  >
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </InstrumentFrame>
      </div>

      {/* Mobile: a real vertical journey, not the desktop layout shrunk down */}
      <ol className="relative mx-auto mt-14 max-w-md space-y-8 md:hidden">
        <div
          aria-hidden="true"
          className="bg-border absolute top-2 bottom-2 left-6 w-px sm:left-7"
        />
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative flex gap-4 sm:gap-5">
            <div className="bg-primary text-primary-foreground relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full text-base font-bold shadow-lift sm:size-14">
              {i + 1}
            </div>
            <div className="pt-1.5">
              <div className="flex items-center gap-2">
                <step.icon className="text-primary size-4" />
                <h3 className="text-sm font-semibold sm:text-base">{step.title}</h3>
              </div>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
