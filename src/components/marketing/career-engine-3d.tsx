import { lazy, Suspense } from "react";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";
import { EngineNetworkStatic } from "@/components/marketing/engine-network-static";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useIdleMount } from "@/hooks/use-idle-mount";

// Three.js + @react-three/fiber only ever load in this chunk, and only once
// this component actually mounts client-side — never in the initial page
// bundle, never during SSR.
const CareerEngineScene = lazy(() => import("@/components/marketing/career-engine-scene"));

/**
 * The landing hero's signature visual: a small, legible 3D node network
 * (career → skills → roadmap → projects → a matching job) that gently
 * rotates, offers mouse-parallax, and expands whichever node you hover.
 *
 * Renders the static SVG projection of the exact same data until the 3D
 * bundle has loaded (no layout shift), and never mounts the 3D scene at all
 * under prefers-reduced-motion or during SSR — reduced-motion users always
 * get the static version.
 */
export function CareerEngine3D({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  // Deferred to idle time rather than the first post-hydration tick -- the
  // static SVG below renders immediately either way, so this only delays
  // when the ~234KB gzipped Three.js chunk starts fetching, not what the
  // visitor sees at first paint.
  const idle = useIdleMount();

  const show3D = idle && !reducedMotion;

  return (
    <InstrumentFrame
      label="Career intelligence engine"
      // "LIVE" describes this engine (it's real, working data — never a
      // fabricated health check), not which rendering mode is active, so
      // it's shown from the very first paint instead of waiting on the
      // post-hydration `mounted` flip. Gating it on `mounted` used to
      // produce a visible STATIC → LIVE swap once JS took over; the actual
      // 3D-vs-static-SVG choice (`show3D`) still only affects which visual
      // renders below, never this label.
      status="LIVE"
      className={className}
    >
      <div className="aspect-square w-full sm:aspect-4/3">
        {show3D ? (
          <Suspense fallback={<EngineNetworkStatic className="h-full w-full p-6" />}>
            <CareerEngineScene />
          </Suspense>
        ) : (
          <EngineNetworkStatic className="h-full w-full p-6" />
        )}
      </div>
    </InstrumentFrame>
  );
}
