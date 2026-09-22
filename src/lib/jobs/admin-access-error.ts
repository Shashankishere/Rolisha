/**
 * Client-safe (no ".server" suffix, no server-only imports) marker and
 * parser for `AdminAccessError` (thrown by
 * `src/lib/jobs/require-admin.server.ts`). Only `error.message` reliably
 * survives the TanStack Start server-function RPC boundary, so the error
 * class encodes a parseable marker into it -- this file is the shared
 * contract between that encoding and anything on the client that needs to
 * react to it (see `src/components/admin/admin-access-fallback.tsx`).
 *
 * This lets an admin route's error boundary tell "you're genuinely not an
 * admin" (expected, not a bug) apart from "the permission check itself
 * failed" or "an unrelated error happened after the check passed" (both of
 * which should surface as a real, visible error -- not be silently
 * relabeled as a permissions problem).
 */

export const ADMIN_ACCESS_ERROR_MARKER = "ADMIN_ACCESS_ERROR";

export type AdminAccessErrorCode = "not_admin" | "verification_failed";

export interface ParsedAdminAccessError {
  code: AdminAccessErrorCode;
  message: string;
}

export function parseAdminAccessError(error: unknown): ParsedAdminAccessError | null {
  if (!(error instanceof Error) || typeof error.message !== "string") return null;
  const parts = error.message.split("::");
  if (parts.length < 2 || parts[0] !== ADMIN_ACCESS_ERROR_MARKER) return null;
  const code = parts[1];
  if (code !== "not_admin" && code !== "verification_failed") return null;
  const message =
    parts.slice(2).join("::") ||
    (code === "not_admin" ? "Admin role required." : "Unable to verify permissions.");
  return { code, message };
}
