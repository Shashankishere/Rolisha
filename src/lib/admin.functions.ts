import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AdminAssessmentRow,
  AdminCareerRow,
  AdminCatalogSummary,
  AdminOverview,
  AdminProjectRow,
  AdminResourceRow,
  AdminUserRow,
} from "@/lib/admin.server";
import { PLAN_TIERS } from "@/lib/subscription";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens only, e.g. data-analyst.",
  );

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const { getAdminOverview: get } = await import("@/lib/admin.server");
    return get(context.supabase, context.userId);
  });

export const getAdminCareers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCareerRow[]> => {
    const { listAdminCareers } = await import("@/lib/admin.server");
    return listAdminCareers(context.supabase, context.userId);
  });

const setCareerActiveSchema = z.object({ careerId: z.string().uuid(), isActive: z.boolean() });

export const setCareerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setCareerActiveSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { setCareerActive: setActive } = await import("@/lib/admin.server");
    return setActive(context.supabase, context.userId, data.careerId, data.isActive);
  });

const careerInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(200),
  shortDescription: z.string().trim().max(500).nullable(),
  description: z.string().trim().max(20_000).nullable(),
  seoTitle: z.string().trim().max(200).nullable(),
  seoDescription: z.string().trim().max(500).nullable(),
  typicalSalaryMin: z.number().min(0).max(100_000_000).nullable(),
  typicalSalaryMax: z.number().min(0).max(100_000_000).nullable(),
  salaryCurrency: z.string().trim().max(8).nullable(),
});

export const createCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => careerInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminCareerRow> => {
    const { createCareer: create } = await import("@/lib/admin.server");
    return create(context.supabase, context.userId, data);
  });

const updateCareerSchema = careerInputSchema.extend({ careerId: z.string().uuid() });

export const updateCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateCareerSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminCareerRow> => {
    const { updateCareer: update } = await import("@/lib/admin.server");
    const { careerId, ...input } = data;
    return update(context.supabase, context.userId, careerId, input);
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    const { listAdminUsers } = await import("@/lib/admin.server");
    return listAdminUsers(context.supabase, context.userId);
  });

const setUserAdminRoleSchema = z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() });

export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setUserAdminRoleSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { setUserAdminRole: setRole } = await import("@/lib/admin.server");
    return setRole(context.supabase, context.userId, data.userId, data.makeAdmin);
  });

const setUserPlanSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(PLAN_TIERS as [string, ...string[]]),
});

export const setUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => setUserPlanSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { setUserPlan: setPlan } = await import("@/lib/admin.server");
    return setPlan(context.supabase, context.userId, data.userId, data.plan as never);
  });

export const getAdminCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCatalogSummary> => {
    const { listAdminCatalog } = await import("@/lib/admin.server");
    return listAdminCatalog(context.supabase, context.userId);
  });

// --- Resources --------------------------------------------------------------

const resourceInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  provider: z.string().trim().max(120).nullable(),
  url: z.string().trim().url().max(500),
  type: z.enum(["documentation", "course", "video", "book", "practice", "project"]),
  skillId: z.string().uuid().nullable(),
  careerId: z.string().uuid().nullable(),
  isFree: z.boolean(),
  estimatedHours: z.number().min(0).max(1000).nullable(),
  description: z.string().trim().max(2000).nullable(),
});

export const createResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => resourceInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminResourceRow> => {
    const { createResource: create } = await import("@/lib/admin.server");
    return create(context.supabase, context.userId, data);
  });

const updateResourceSchema = resourceInputSchema.extend({ resourceId: z.string().uuid() });

export const updateResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateResourceSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminResourceRow> => {
    const { updateResource: update } = await import("@/lib/admin.server");
    const { resourceId, ...input } = data;
    return update(context.supabase, context.userId, resourceId, input);
  });

const resourceIdSchema = z.object({ resourceId: z.string().uuid() });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => resourceIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { deleteResource: remove } = await import("@/lib/admin.server");
    return remove(context.supabase, context.userId, data.resourceId);
  });

// --- Projects -----------------------------------------------------------------

const listOfLinesSchema = z.array(z.string().trim().min(1).max(500)).max(30).default([]);

const projectInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(1000).nullable(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedHours: z.number().int().min(1).max(1000),
  careerId: z.string().uuid().nullable(),
  skills: listOfLinesSchema,
  datasetSuggestion: z.string().trim().max(500).nullable(),
  requirements: listOfLinesSchema,
  expectedOutput: z.string().trim().max(1000).nullable(),
  readmeOutline: listOfLinesSchema,
  resumeBullet: z.string().trim().max(300).nullable(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => projectInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminProjectRow> => {
    const { createProject: create } = await import("@/lib/admin.server");
    return create(context.supabase, context.userId, data);
  });

const updateProjectSchema = projectInputSchema.extend({ projectId: z.string().uuid() });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateProjectSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminProjectRow> => {
    const { updateProject: update } = await import("@/lib/admin.server");
    const { projectId, ...input } = data;
    return update(context.supabase, context.userId, projectId, input);
  });

const projectIdSchema = z.object({ projectId: z.string().uuid() });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => projectIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { deleteProject: remove } = await import("@/lib/admin.server");
    return remove(context.supabase, context.userId, data.projectId);
  });

// --- Assessments ----------------------------------------------------------

const assessmentInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(200),
  skillId: z.string().uuid().nullable(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  description: z.string().trim().max(2000).nullable(),
  passScore: z.number().int().min(0).max(100),
});

export const createAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => assessmentInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminAssessmentRow> => {
    const { createAssessment: create } = await import("@/lib/admin.server");
    return create(context.supabase, context.userId, data);
  });

const updateAssessmentSchema = assessmentInputSchema.extend({ assessmentId: z.string().uuid() });

export const updateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateAssessmentSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminAssessmentRow> => {
    const { updateAssessment: update } = await import("@/lib/admin.server");
    const { assessmentId, ...input } = data;
    return update(context.supabase, context.userId, assessmentId, input);
  });

const assessmentIdSchema = z.object({ assessmentId: z.string().uuid() });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => assessmentIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { deleteAssessment: remove } = await import("@/lib/admin.server");
    return remove(context.supabase, context.userId, data.assessmentId);
  });
