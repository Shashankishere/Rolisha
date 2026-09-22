import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RoadmapView, Workspace } from "@/lib/me-types";
import type { CareerRoadmapSummary } from "@/lib/me.server";

const proficiency = z.enum(["none", "beginner", "intermediate", "advanced", "expert"]);

const onboardingSchema = z.object({
  fullName: z.string().trim().max(100).optional(),
  careerId: z.string().uuid().nullable(),
  targetRole: z.string().trim().min(2).max(120),
  educationLevel: z.enum(["high_school", "diploma", "bachelors", "masters", "phd", "other"]),
  degree: z.string().trim().max(120).optional(),
  fieldOfStudy: z.string().trim().max(120).optional(),
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
  experience: z.enum(["none", "lt_1", "1_2", "2_5", "5_plus"]),
  hoursPerWeek: z.number().int().min(1).max(40),
  salaryTarget: z.number().min(0).max(10_000_000).nullable().optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite", "any"]),
  skills: z.array(z.object({ skillId: z.string().uuid(), level: proficiency })).max(120),
});

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Workspace> => {
    const { loadWorkspace } = await import("@/lib/me.server");
    return loadWorkspace(context.supabase, context.userId);
  });

/** Lightweight check used only to decide whether to show the Admin nav
 * link — reads the caller's own user_roles row under RLS, no admin
 * privilege required to call this. The admin panel's own pages/functions
 * still independently enforce requireAdmin server-side. */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  });

export const getRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoadmapView | null> => {
    const { loadActiveRoadmap } = await import("@/lib/me.server");
    const { getUserPlan } = await import("@/lib/subscription.server");
    const plan = await getUserPlan(context.supabase, context.userId);
    return loadActiveRoadmap(context.supabase, context.userId, plan);
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => onboardingSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { regenerateRoadmapFor } = await import("@/lib/me.server");
    const supabase = context.supabase;
    const userId = context.userId;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: data.fullName || null,
        career_id: data.careerId,
        target_role: data.targetRole,
        education_level: data.educationLevel,
        degree: data.degree || null,
        field_of_study: data.fieldOfStudy || null,
        graduation_year: data.graduationYear ?? null,
        experience: data.experience,
        hours_per_week: data.hoursPerWeek,
        salary_target: data.salaryTarget ?? null,
        country: data.country || null,
        city: data.city || null,
        work_mode: data.workMode,
        onboarding_completed: true,
      })
      .eq("id", userId);
    if (profileError) throw new Error("Unable to save your profile.");

    await supabase.from("user_skills").delete().eq("user_id", userId);
    if (data.skills.length > 0) {
      const { error: skillError } = await supabase.from("user_skills").insert(
        data.skills.map((skill) => ({
          user_id: userId,
          skill_id: skill.skillId,
          level: skill.level,
          source: "self_reported",
        })),
      );
      if (skillError) throw new Error("Unable to save your skills.");
    }

    const result = await regenerateRoadmapFor(supabase, userId);
    return { ok: true, readiness: result.readiness };
  });

export const regenerateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { regenerateRoadmapFor } = await import("@/lib/me.server");
    return regenerateRoadmapFor(context.supabase, context.userId);
  });

export const setTaskCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ taskId: z.string().uuid(), completed: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { getUserPlan } = await import("@/lib/subscription.server");
    const { loadTaskForCompletion } = await import("@/lib/me.server");
    const plan = await getUserPlan(supabase, userId);
    // Throws if this task belongs to a Free-plan month that isn't
    // unlocked yet -- see `loadTaskForCompletion` for why this can't just
    // rely on the client not rendering a checkbox for a locked month.
    const task = await loadTaskForCompletion(supabase, userId, data.taskId, plan);

    const { error } = await supabase
      .from("roadmap_tasks")
      .update({
        is_completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
      })
      .eq("id", data.taskId)
      .eq("user_id", userId);
    if (error) throw new Error("Unable to update this task.");

    if (data.completed) {
      await supabase.from("progress_events").insert({
        user_id: userId,
        event_type: "task_completed",
        label: task.title,
      });
    }
    return { ok: true };
  });

export const setSkillLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ skillId: z.string().uuid(), level: proficiency }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { syncReadiness } = await import("@/lib/me.server");
    const { error } = await context.supabase.from("user_skills").upsert(
      {
        user_id: context.userId,
        skill_id: data.skillId,
        level: data.level,
        source: "self_reported",
      },
      { onConflict: "user_id,skill_id" },
    );
    if (error) throw new Error("Unable to update this skill.");
    const readiness = await syncReadiness(context.supabase, context.userId);
    return { ok: true, readiness };
  });

export const getCareerRoadmaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CareerRoadmapSummary[]> => {
    const { listCareerRoadmaps } = await import("@/lib/me.server");
    return listCareerRoadmaps(context.supabase, context.userId);
  });

export const addCareerRoadmapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ careerId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { addCareerRoadmap } = await import("@/lib/me.server");
    return addCareerRoadmap(context.supabase, context.userId, data.careerId);
  });

export const setPrimaryCareerRoadmapFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ roadmapId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { setPrimaryCareerRoadmap } = await import("@/lib/me.server");
    await setPrimaryCareerRoadmap(context.supabase, context.userId, data.roadmapId);
    return { ok: true };
  });
