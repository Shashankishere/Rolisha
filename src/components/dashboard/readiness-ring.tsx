import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  size?: number;
  label?: string;
  className?: string;
  animate?: boolean;
  /** Adds a decorative instrument-dial bezel (tick marks lit up to the
   * current value, soft depth glow) for the dashboard's hero "command
   * center" treatment. Off by default so the plain ring used elsewhere
   * (marketing preview, progress page) is unaffected. Every tick's lit/dim
   * state is derived from the real `value`, not arbitrary decoration. */
  instrument?: boolean;
}

/** Accessible animated circular progress indicator. */
export function ReadinessRing({
  value,
  size = 160,
  label = "Job readiness",
  className,
  animate = true,
  instrument = false,
}: Props) {
  const [display, setDisplay] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      return;
    }
    const frame = requestAnimationFrame(() => setDisplay(value));
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  const stroke = Math.max(6, Math.round(size * 0.085));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, display)) / 100);
  const tickCount = 24;
  const tickRadius = size / 2 + 4;

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: instrument ? size + 20 : size, height: instrument ? size + 20 : size }}
      role="img"
      aria-label={`${label}: ${value} percent`}
    >
      {instrument && (
        <>
          {/* Soft depth glow behind the ring — reads as the instrument
              casing sitting slightly forward of the panel. */}
          <div
            aria-hidden="true"
            className="bg-brand-gradient absolute rounded-full opacity-20 blur-2xl"
            style={{ width: size * 0.85, height: size * 0.85 }}
          />
          {/* Dial bezel: tick marks lit up to the current value, exactly
              like the arc itself — decorative framing, not a second
              data source. */}
          <svg
            width={size + 20}
            height={size + 20}
            className="absolute -rotate-90"
            aria-hidden="true"
          >
            {Array.from({ length: tickCount }).map((_, i) => {
              const angle = (i / tickCount) * Math.PI * 2;
              const lit = i / tickCount <= Math.min(100, Math.max(0, value)) / 100;
              const cx = size / 2 + 10;
              const cy = size / 2 + 10;
              const x1 = cx + Math.cos(angle) * (tickRadius - 3);
              const y1 = cy + Math.sin(angle) * (tickRadius - 3);
              const x2 = cx + Math.cos(angle) * tickRadius;
              const y2 = cy + Math.sin(angle) * tickRadius;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={lit ? "var(--primary)" : "var(--border)"}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  opacity={lit ? 0.8 : 0.4}
                />
              );
            })}
          </svg>
        </>
      )}
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={`ring-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-${size})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute grid place-items-center text-center">
        <span
          className="font-display font-semibold tabular-nums"
          style={{ fontSize: Math.round(size * 0.26) }}
        >
          {value}%
        </span>
      </div>
    </div>
  );
}
