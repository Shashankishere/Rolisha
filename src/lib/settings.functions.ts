import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateProfileSchema = z.object({
  fullName: z.string().trim().max(100).optional(),
  targetRole: z.string().trim().min(2).max(120).optional(),
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
  salaryTarget: z.number().min(0).max(10_000_000).nullable().optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite", "any"]).optional(),
});

/** Updates the current user's profile fields only — never touches skills,
 * education, career_id, or regenerates the roadmap. See settings.server.ts. */
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateProfileSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { updateProfileCore } = await import("@/lib/settings.server");
    return updateProfileCore(context.supabase, context.userId, data);
  });

const deleteAccountSchema = z.object({
  // Requires the caller to type their own email to confirm — mirrors the
  // "type the resource name to confirm" pattern used by most SaaS delete
  // flows, and is checked against the authenticated user's own email so a
  // stolen/duplicated request body can't confirm on someone else's behalf.
  confirmEmail: z.string().trim().email(),
});

/** Permanently deletes the current user's account and all owned data. Irreversible. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteAccountSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: userResult, error: userError } = await context.supabase.auth.getUser();
    if (userError || !userResult?.user?.email) {
      throw new Error("Unable to verify your account.");
    }
    if (userResult.user.email.toLowerCase() !== data.confirmEmail.trim().toLowerCase()) {
      throw new Error("That email doesn't match your account.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteAccountCore } = await import("@/lib/settings.server");
    return deleteAccountCore(supabaseAdmin, context.userId);
  });
