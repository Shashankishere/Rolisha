import { useRef, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a button/CTA so it subtly follows the cursor when hovered nearby —
 * a small, restrained "magnetic" pull rather than a large distracting one.
 * Purely pointer-driven (no touch events fire this, so it's naturally
 * inert on mobile), and the global prefers-reduced-motion rule in
 * styles.css zeroes the transition duration for anyone who's asked for
 * reduced motion, so the pull becomes an instant snap instead of a glide.
 */
export function MagneticButton({
  children,
  className,
  strength = 14,
}: {
  children: ReactNode;
  className?: string;
  /** Max pixels the content shifts toward the cursor. Keep small. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * strength;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * strength;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function handleMouseLeave() {
    if (ref.current) ref.current.style.transform = "translate(0, 0)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("inline-block transition-transform duration-150 ease-out", className)}
    >
      {children}
    </div>
  );
}
