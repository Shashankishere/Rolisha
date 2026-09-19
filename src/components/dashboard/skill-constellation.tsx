import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";
import {
  IMPORTANCE_WEIGHT,
  PROFICIENCY_LABEL,
  skillCoverage,
  type SkillGapRow,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<SkillGapRow["status"], string> = {
  ready: "var(--success)",
  in_progress: "var(--primary)",
  missing: "var(--muted-foreground)",
};

/** Node diameter in %, scaled by the skill's importance weight (0.5–2.2) so
 * a critical requirement reads as visually larger than a nice-to-have one
 * at a glance, without needing the tooltip. */
function nodeSize(importance: SkillGapRow["importance"]): number {
  const t = (IMPORTANCE_WEIGHT[importance] - 0.5) / (2.2 - 0.5); // 0..1
  return 34 + t * 18; // 34px..52px
}

/**
 * Measures a tooltip against a bounding container after it mounts/updates
 * and returns inline style overrides that pull it back inside the
 * container on whichever edges it would otherwise overflow. Re-measures on
 * resize (mobile/tablet/desktop) since the container is fluid (aspect-square
 * of a responsive grid card). Returns {} until it has measured, so the
 * tooltip's default centered/below placement is the initial paint — no
 * visible jump for the common (non-edge) case.
 */
function useEdgeAwarePlacement<T extends HTMLElement>(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  const ref = useRef<T | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!active) {
      setStyle({});
      return;
    }

    const measure = () => {
      const tooltip = ref.current;
      const container = containerRef.current;
      if (!tooltip || !container) return;

      // Reset before measuring so a previous flip doesn't bias this one.
      tooltip.style.left = "";
      tooltip.style.right = "";
      tooltip.style.top = "";
      tooltip.style.bottom = "";
      tooltip.style.transform = "";

      const tooltipRect = tooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const next: React.CSSProperties = {};
      const margin = 8;

      if (tooltipRect.left < containerRect.left + margin) {
        next.left = 0;
        next.right = "auto";
        next.transform = "translateX(0)";
      } else if (tooltipRect.right > containerRect.right - margin) {
        next.left = "auto";
        next.right = 0;
        next.transform = "translateX(0)";
      }

      if (tooltipRect.bottom > containerRect.bottom - margin) {
        next.top = "auto";
        next.bottom = "100%";
      } else if (tooltipRect.top < containerRect.top + margin) {
        next.top = "100%";
        next.bottom = "auto";
      }

      setStyle(next);
    };

    // Measure after paint (tooltip must be in the DOM with real size first).
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { ref, style };
}

/**
 * Interactive 2.5D skill graph for the dashboard, built from the user's
 * real skill-gap data (not illustrative — every node here is an actual
 * required skill for their target role). Node size scales with the
 * skill's importance to the target role; the ring around each node fills
 * to show real coverage (current level ÷ required level), so gap and
 * priority are both readable before any interaction. Hover/focus reveals
 * the precise current/target level and gap %; clicking any node goes to
 * the full skill-gap page, which is a complete non-3D, screen-reader
 * accessible representation of the same data — this graph is a shortcut
 * to it, never the only way to reach it.
 *
 * Deliberately CSS/SVG (perspective + translateZ), not a WebGL canvas: the
 * data here is per-user and needs to stay simple to keep correct on every
 * page load, and this is a content-dense authenticated page where
 * usability matters more than a heavier render.
 */
function ConstellationNode({
  node,
  x,
  y,
  isHovered,
  onEnter,
  onLeave,
  containerRef,
  ringR,
  ringCircumference,
}: {
  node: SkillGapRow;
  x: number;
  y: number;
  isHovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  ringR: number;
  ringCircumference: number;
}) {
  const size = nodeSize(node.importance);
  const coverage = skillCoverage(node.yourLevel, node.requiredLevel);
  const tooltipId = `constellation-node-${node.skillId}`;
  const { ref: tooltipRef, style: tooltipStyle } = useEdgeAwarePlacement<HTMLDivElement>(
    containerRef,
    isHovered,
  );

  return (
    <Link
      to="/skills"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      aria-describedby={tooltipId}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200",
        isHovered && "z-20 scale-125",
      )}
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, zIndex: 1 }}
    >
      {/* coverage ring: how much of the required level is met */}
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90">
        <circle cx="20" cy="20" r={ringR} fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="20"
          cy="20"
          r={ringR}
          fill="none"
          stroke={STATUS_COLOR[node.status]}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringCircumference * (1 - coverage)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span
        className={cn(
          "border-border/70 bg-card absolute inset-[2px] flex items-center justify-center rounded-full border px-0.5 text-center text-[9px] leading-[1.05] break-words font-medium",
          isHovered && "shadow-glow",
        )}
        style={{ color: STATUS_COLOR[node.status] }}
      >
        {node.name}
      </span>
      {isHovered && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={tooltipStyle}
          className="border-border/70 bg-popover text-popover-foreground shadow-lift absolute top-full left-1/2 z-30 mt-2 w-36 -translate-x-1/2 rounded-lg border p-2.5 text-left text-[11px] leading-relaxed font-normal sm:w-40"
        >
          <p className="font-display text-xs font-semibold">{node.name}</p>
          <p className="text-muted-foreground mt-0.5">
            {PROFICIENCY_LABEL[node.yourLevel]} → {PROFICIENCY_LABEL[node.requiredLevel]}
          </p>
          <p className="text-muted-foreground">{node.gapPercentage}% gap remaining</p>
        </div>
      )}
    </Link>
  );
}

export function SkillConstellation({ gaps }: { gaps: SkillGapRow[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodes = gaps.slice(0, 8);

  if (nodes.length === 0) {
    return null;
  }

  const radius = 36;
  const center = 50;
  const ringR = 15; // SVG user-units radius for the per-node coverage ring
  const ringCircumference = 2 * Math.PI * ringR;

  return (
    <InstrumentFrame label="Skill constellation" status={`${nodes.length} SKILLS`}>
      {/* Bounding box tooltips (and node labels) are measured/positioned
          against this container. It intentionally does NOT clip overflow:
          the "Target role" center label, long skill names like "API Design"
          or "Node.js", and the "N SKILLS" readout in the frame header must
          never be hidden by a corner-radius clip — the edge-aware tooltip
          hook repositions using this element's bounding rect, it doesn't
          need overflow-hidden to do that. */}
      <div ref={containerRef} className="relative isolate rounded-xl p-6">
        <div className="[perspective:1200px]">
          <div className="relative aspect-square w-full [transform-style:preserve-3d] [transform:rotateX(8deg)]">
            {/* connecting lines from center to each node */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              {nodes.map((node, i) => {
                const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
                const x = center + Math.cos(angle) * radius;
                const y = center + Math.sin(angle) * radius;
                const active = hoveredId === node.skillId;
                return (
                  <line
                    key={node.skillId}
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke={active ? "var(--primary)" : "var(--border)"}
                    strokeWidth={active ? 0.8 : 0.5}
                  />
                );
              })}
            </svg>

            {/* center node: the target role */}
            <div
              className="bg-primary text-primary-foreground shadow-glow absolute flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-center text-[10px] leading-tight font-semibold"
              style={{ left: `${center}%`, top: `${center}%` }}
            >
              Target
              <br />
              role
            </div>

            {/* skill nodes */}
            {nodes.map((node, i) => {
              const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
              const x = center + Math.cos(angle) * radius;
              const y = center + Math.sin(angle) * radius;
              return (
                <ConstellationNode
                  key={node.skillId}
                  node={node}
                  x={x}
                  y={y}
                  isHovered={hoveredId === node.skillId}
                  onEnter={() => setHoveredId(node.skillId)}
                  onLeave={() => setHoveredId(null)}
                  containerRef={containerRef}
                  ringR={ringR}
                  ringCircumference={ringCircumference}
                />
              );
            })}
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Node size = importance to your target role · ring = current coverage. Hover a skill for
          detail, click to open the full skill gap page.
        </p>
      </div>
    </InstrumentFrame>
  );
}
