import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContactMessageItem, ContactMessageStatus } from "@/lib/admin-contact.server";

const listSchema = z.object({
  status: z.enum(["all", "new", "read", "resolved"]).optional(),
  search: z.string().max(200).optional(),
});

export const getContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSchema.parse(data ?? {}))
  .handler(async ({ context, data }): Promise<ContactMessageItem[]> => {
    const { listContactMessages } = await import("@/lib/admin-contact.server");
    return listContactMessages(context.supabase, context.userId, data);
  });

const updateStatusSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(["new", "read", "resolved"]),
});

export const updateContactMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateStatusSchema.parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { setContactMessageStatus } = await import("@/lib/admin-contact.server");
    return setContactMessageStatus(
      context.supabase,
      context.userId,
      data.messageId,
      data.status as ContactMessageStatus,
    );
  });
