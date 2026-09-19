/**
 * Confirms the already-authenticated user (see requireSupabaseAuth) also
 * holds the 'admin' app role, using the RLS-scoped client so this check
 * itself can never read another user's role row. Only after this passes
 * should a caller reach for the service-role client to perform admin writes.
 *
 * Deliberately queries WITHOUT `.maybeSingle()`/`.single()`: those methods
 * ask PostgREST to enforce "exactly 0 or 1 rows", and reject with an error
 * if more than one row matches. A user having BOTH a 'user' role row and an
 * 'admin' role row is completely normal (the signup trigger grants 'user'
 * by default; 'admin' is granted separately) and must not affect this
 * check -- the query already filters to role = 'admin' specifically, so it
 * only ever needs to know "is there at least one matching row", which a
 * plain array result answers robustly regardless of how many other role
 * rows exist for that user.
 */
import {
  ADMIN_ACCESS_ERROR_MARKER,
  type AdminAccessErrorCode,
} from "@/lib/jobs/admin-access-error";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/** Thrown by `requireAdmin`. The marker + code are encoded into
 * `error.message` (not just a class field) because only the message
 * string reliably survives serialization across the TanStack Start
 * server-function RPC boundary -- the same pattern `UpgradeRequiredError`
 * uses in `src/lib/subscription.ts`. Parse it with
 * `parseAdminAccessError()` on the client to distinguish "you're genuinely
 * not an admin" from "the check itself failed unexpectedly", instead of
 * treating every thrown error in an admin route the same way. */
export class AdminAccessError extends Error {
  readonly code: AdminAccessErrorCode;
  constructor(code: AdminAccessErrorCode, humanMessage: string) {
    super(`${ADMIN_ACCESS_ERROR_MARKER}::${code}::${humanMessage}`);
    this.name = "AdminAccessError";
    this.code = code;
  }
}

export async function requireAdmin(supabase: Client, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin");

  if (error) {
    // A genuinely unexpected failure (network/DB error) -- NOT the same
    // thing as "not an admin". Logged with the userId only (already known
    // server-side from the authenticated session; no other PII) so a real
    // bug here is traceable instead of silently presenting as "access
    // denied".
    console.error(
      `[requireAdmin] verification query failed userId=${userId} dbError=${error.message ?? "unknown"}`,
    );
    throw new AdminAccessError(
      "verification_failed",
      "Unable to verify admin permissions right now. Please try again.",
    );
  }

  const isAdmin = Array.isArray(data) && data.length > 0;
  if (!isAdmin) {
    console.warn(`[requireAdmin] denied userId=${userId} reason=no_admin_role_row`);
    throw new AdminAccessError("not_admin", "Forbidden: admin role required.");
  }
}
