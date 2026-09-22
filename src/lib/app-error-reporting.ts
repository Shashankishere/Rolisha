type AppErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

/**
 * Reports an error to the browser console (and, if a monitoring provider is
 * ever wired in, to that provider) with the context needed to trace it back
 * to the route/component that threw. Currently a thin console wrapper; swap
 * the body for a real monitoring SDK call when one is added.
 */
export function reportAppError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: AppErrorOptions = {},
) {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error("[app-error]", message, {
    route: window.location.pathname,
    mechanism: options.mechanism ?? "manual",
    severity: options.severity ?? "error",
    ...context,
  });
}
