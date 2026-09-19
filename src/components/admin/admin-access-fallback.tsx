import { AlertTriangle, ShieldAlert } from "lucide-react";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { parseAdminAccessError } from "@/lib/jobs/admin-access-error";

/**
 * Drop-in replacement for the hardcoded "Admin access required." block
 * every admin route used to render for ANY thrown error, regardless of
 * what actually failed. Before this, a genuinely different bug (a broken
 * query elsewhere in the same loader, a transient DB error verifying the
 * admin role, etc) would show the exact same "you don't have permission"
 * message as a real, correct access denial -- actively hiding the true
 * cause from whoever hit it.
 *
 * Behavior:
 *  - `AdminAccessError("not_admin", ...)`  -> the expected, correct denial.
 *  - `AdminAccessError("verification_failed", ...)` -> the permission
 *     check itself broke (e.g. a DB error) -- shown distinctly so it
 *     doesn't get mistaken for "you're not an admin".
 *  - anything else -> shown as a plain error with its real message, never
 *     silently relabeled as an admin/permissions issue.
 */
export function AdminAccessFallback({
  error,
  reset,
  routeId,
  title,
}: {
  error: Error;
  reset: () => void;
  routeId: string;
  title: string;
}) {
  const parsed = parseAdminAccessError(error);

  if (!parsed) {
    return (
      <RouteErrorFallback
        error={error}
        reset={reset}
        routeId={routeId}
        title={title}
        description="Something went wrong loading this page."
      >
        <div className="panel hover-lift flex flex-col items-center gap-3 p-10 text-center">
          <AlertTriangle className="text-destructive size-8" />
          <p className="text-sm font-medium">Something went wrong.</p>
          <p className="text-muted-foreground max-w-md text-sm">{error.message}</p>
        </div>
      </RouteErrorFallback>
    );
  }

  if (parsed.code === "verification_failed") {
    return (
      <RouteErrorFallback
        error={error}
        reset={reset}
        routeId={routeId}
        title={title}
        description="Couldn't verify your permissions."
      >
        <div className="panel hover-lift flex flex-col items-center gap-3 p-10 text-center">
          <AlertTriangle className="text-destructive size-8" />
          <p className="text-sm font-medium">Couldn't verify your permissions.</p>
          <p className="text-muted-foreground max-w-md text-sm">{parsed.message}</p>
        </div>
      </RouteErrorFallback>
    );
  }

  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId={routeId}
      title={title}
      description="You may not have permission to view this page."
    >
      <div className="panel hover-lift flex flex-col items-center gap-3 p-10 text-center">
        <ShieldAlert className="text-muted-foreground size-8" />
        <p className="text-sm font-medium">Admin access required.</p>
        <p className="text-muted-foreground max-w-md text-sm">
          This section is restricted to accounts with the admin role.
        </p>
      </div>
    </RouteErrorFallback>
  );
}
