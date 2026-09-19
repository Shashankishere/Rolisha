import { lazy, Suspense } from "react";
import { InstrumentFrame } from "@/components/marketing/instrument-frame";
import { EngineNetworkStatic } from "@/components/marketing/engine-network-static";
import {
  CONSTELLATION_EDGES,
  CONSTELLATION_NODES,
} from "@/components/marketing/engine-network-data";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useIdleMount } from "@/hooks/use-idle-mount";

// Reuses the exact same lazy chunk as the hero's CareerEngine3D — Three.js
// is only ever fetched once per page, regardless of how many sections use
// it, since dynamic imports are cached by module specifier.
const CareerEngineScene = lazy(() => import("@/components/marketing/career-engine-scene"));

/**
 * "Skill Intelligence": a small constellation showing how individual
 * skills connect to a target role (e.g. SQL, Python, Statistics, Excel all
 * feeding into Data Analyst) — the same node/edge visual language as the
 * hero, applied to skills instead of the whole career system, so the
 * motif reads as one consistent idea rather than two different gimmicks.
 */
export function SkillConstellationSection() {
  const reducedMotion = useReducedMotion();
  // Same idle-time deferral as the hero's CareerEngine3D -- and since
  // dynamic imports are cached by module specifier, if the hero already
  // triggered the fetch this section's mount is effectively free.
  const idle = useIdleMount();
  const show3D = idle && !reducedMotion;

  return (
    <section className="border-border/70 border-b px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            Skill intelligence
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold text-balance sm:text-4xl">
            Every skill you learn connects to something real.
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg text-base text-pretty sm:text-lg">
            Rolisha doesn't hand you a flat list of skills to memorize. Each one is mapped to the
            role it serves, the projects that use it, and the jobs that require it — so you always
            know why you're learning it, not just what it is.
          </p>
        </div>
        {/* "LIVE" describes the skill graph itself (real per-user data),
            not the rendering mode, so it's shown immediately instead of
            waiting on the post-hydration `mounted` flip that used to cause
            a visible STATIC → LIVE swap right after load. */}
        <InstrumentFrame label="Skill constellation" status="LIVE">
          <div className="aspect-square w-full sm:aspect-4/3">
            {show3D ? (
              <Suspense
                fallback={
                  <EngineNetworkStatic
                    nodes={CONSTELLATION_NODES}
                    edges={CONSTELLATION_EDGES}
                    className="h-full w-full p-6"
                  />
                }
              >
                <CareerEngineScene nodes={CONSTELLATION_NODES} edges={CONSTELLATION_EDGES} />
              </Suspense>
            ) : (
              <EngineNetworkStatic
                nodes={CONSTELLATION_NODES}
                edges={CONSTELLATION_EDGES}
                className="h-full w-full p-6"
              />
            )}
          </div>
        </InstrumentFrame>
      </div>
    </section>
  );
}
