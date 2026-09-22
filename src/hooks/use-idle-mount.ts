import { useEffect, useState } from "react";

/**
 * Mounts `true` only once the browser reports idle time (or, in browsers
 * without `requestIdleCallback` -- Safari -- after a short fixed delay),
 * instead of immediately in the first post-hydration effect tick.
 *
 * Used to defer heavy, non-critical, purely decorative client bundles
 * (the landing page's Three.js scenes) so their fetch/parse/execute cost
 * never competes with hydration and other above-the-fold work for the
 * first meaningful paint. The visual result is unchanged -- callers still
 * render an immediate static fallback and swap in the real thing once
 * this flips true -- only the timing of *when* the heavy chunk starts
 * downloading moves a bit later.
 */
export function useIdleMount(): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(() => setIdle(true), { timeout: 1500 });
      return () => {
        const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void })
          .cancelIdleCallback;
        cancel?.(id);
      };
    }
    const timeout = window.setTimeout(() => setIdle(true), 200);
    return () => window.clearTimeout(timeout);
  }, []);

  return idle;
}
