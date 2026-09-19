import { useEffect, useState } from "react";

/**
 * The global CSS `prefers-reduced-motion` rule in styles.css handles
 * CSS transitions/animations, but it can't stop a JS animation loop (e.g.
 * a WebGL `requestAnimationFrame` loop in a Three.js scene). Components
 * that drive their own animation loop should check this hook and skip
 * mounting/animating entirely when it's true.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}
