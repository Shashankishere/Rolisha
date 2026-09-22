import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Exported so the /contact page can validate with the exact same rules
// client-side before submitting — one source of truth, so client and
// server can never quietly disagree about what's "required".
export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(255),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Say a little more so we can help").max(4000),
  // Honeypot field: real visitors never see or fill this input (hidden via
  // CSS), so any non-empty value here means the submission came from a bot.
  // Silently accepted-and-dropped in the handler rather than rejected, so
  // the bot gets no signal that it was detected.
  companyWebsite: z.string().max(200).optional(),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/**
 * Public (unauthenticated) server function for the /contact page. Not
 * behind `requireSupabaseAuth` — visitors don't need an account to reach
 * out. Writes via the service-role client since `contact_messages` has no
 * anon/authenticated RLS policies (see the migration comment); validation
 * and the honeypot check happen here, server-side, before anything is
 * persisted.
 */
export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => contactMessageSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.companyWebsite) {
      // Bot submission — report success without writing anything.
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      subject: data.subject || null,
      message: data.message,
      status: "new",
    });
    if (error) throw new Error("Could not send your message. Please try again.");

    return { ok: true as const };
  });
