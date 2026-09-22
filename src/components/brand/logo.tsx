import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      className={cn("inline-flex items-center gap-2.5 font-display", className)}
      aria-label="Rolisha home"
    >
      <span className="bg-brand-gradient grid size-8 place-items-center rounded-xl shadow-glow">
        {/* Rolisha (Role + Disha, "direction") mark: a curved route sweeping
            up toward a single destination point, in place of the old
            checkmark-arrow. Same stroke weight/dot-accent style as before
            so it drops into every existing usage unchanged. */}
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            d="M4 17.5c2.8-.3 5-1.6 6.4-4.3 1.6-3 4-5.4 7.6-6.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-foreground"
          />
          <circle cx="19" cy="6" r="2.4" className="fill-primary-foreground" />
        </svg>
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight">Rolisha</span>}
    </Link>
  );
}
