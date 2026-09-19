import { useEffect, useRef, useState } from "react";

/**
 * Counts up from 0 (or the previous value) to `value` over a short
 * duration. Used only for real, already-known numbers (task counts,
 * percentages) — never a placeholder. Jumps straight to the final value
 * with no animation for prefers-reduced-motion, matching the global rule
 * in styles.css (which only covers CSS transitions/animations, not this
 * JS-driven count).
 */
export function AnimatedNumber({
  value,
  durationMs = 700,
}: {
  value: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const from = previousValueRef.current;
    const to = value;
    previousValueRef.current = value;

    if (prefersReducedMotion || from === to) {
      setDisplay(to);
      return;
    }

    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic, matching the ring/progress-bar easing elsewhere.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className="tabular-nums">{display}</span>;
}
