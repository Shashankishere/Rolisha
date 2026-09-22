/**
 * Admin view of the `contact_messages` table (see the
 * 20260905000000_contact_messages.sql migration for the schema and RLS
 * rationale — service-role only, no anon/authenticated policies). Every
 * function here calls `requireAdmin` itself before touching the
 * service-role client, matching the pattern already used in
 * `admin.server.ts`.
 */
import { requireAdmin } from "@/lib/jobs/require-admin.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export type ContactMessageStatus = "new" | "read" | "resolved";

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
}

export interface ListContactMessagesParams {
  /** Filter to a single status, or "all" (the default) for every status. */
  status?: ContactMessageStatus | "all" | undefined;
  /** Case-insensitive match against name, email, and subject. */
  search?: string | undefined;
}

export async function listContactMessages(
  rlsClient: Client,
  userId: string,
  params: ListContactMessagesParams = {},
): Promise<ContactMessageItem[]> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin
    .from("contact_messages")
    .select("id, name, email, subject, message, status, created_at")
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const term = params.search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,()]/g, "");
    query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%,subject.ilike.%${escaped}%`);
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error("Unable to load contact submissions.");

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject ?? null,
    message: row.message,
    status: row.status as ContactMessageStatus,
    createdAt: row.created_at,
  }));
}

export async function setContactMessageStatus(
  rlsClient: Client,
  userId: string,
  messageId: string,
  status: ContactMessageStatus,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .update({ status })
    .eq("id", messageId);
  if (error) throw new Error("Unable to update this message.");

  return { ok: true };
}
