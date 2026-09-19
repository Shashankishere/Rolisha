import { useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { reportAppError } from "@/lib/app-error-reporting";

/**
 * Shared `errorComponent` for authenticated routes.
 *
 * Every route previously wrote its own `errorComponent: () => (...)` with a
 * zero-argument function — which silently discarded the real `error` /
 * `reset` TanStack Router passes in, so nothing was ever logged and there
 * was no way to retry without a full page refresh. This component takes
 * the real error, logs it the same way the root error boundary does
 * (console + reportAppError, tagged with which route it came from so
 * it's traceable), and gives a real "Try again" action that re-runs the
 * route's loader instead of just showing static text.
 */
export function RouteErrorFallback({
  error,
  reset,
  routeId,
  title,
  description,
  children,
}: {
  error: Error;
  reset: () => void;
  /** Identifies which route's boundary caught this, for diagnostics. */
  routeId: string;
  title: string;
  description?: string;
  /** Optional custom body (e.g. a permission-denied message) instead of
   * the default description text. */
  children?: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(`[${routeId}]`, error);
    reportAppError(error, { boundary: routeId });
  }, [error, routeId]);

  return (
    <AppShell title={title} {...(description !== undefined ? { description } : {})}>
      {children ?? (
        <div className="panel hover-lift flex flex-col items-center gap-3 p-10 text-center">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            size="sm"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      )}
    </AppShell>
  );
}
