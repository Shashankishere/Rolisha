/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdmin } from "@/lib/jobs/require-admin.server";
import { PLAN_TIERS, type PlanTier } from "@/lib/subscription";

type Client = any;

export interface AdminOverview {
  jobs: { total: number; live: number; demo: number };
  careers: number;
  assessments: number;
  projects: number;
  resources: number;
  users: number;
  admins: number;
  contactMessages: { total: number; new: number };
}

/**
 * Real counts only — every number here comes from a `count`-mode Supabase
 * query against the actual tables. No estimates, no placeholders.
 */
export async function getAdminOverview(rlsClient: Client, userId: string): Promise<AdminOverview> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [
    jobsTotal,
    jobsLive,
    jobsDemo,
    careers,
    assessments,
    projects,
    resources,
    users,
    admins,
    contactTotal,
    contactNew,
  ] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_demo", false),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabaseAdmin.from("careers").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("assessments").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("projects").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("resources").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),
    supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  return {
    jobs: {
      total: jobsTotal.count ?? 0,
      live: jobsLive.count ?? 0,
      demo: jobsDemo.count ?? 0,
    },
    careers: careers.count ?? 0,
    assessments: assessments.count ?? 0,
    projects: projects.count ?? 0,
    resources: resources.count ?? 0,
    users: users.count ?? 0,
    admins: admins.count ?? 0,
    contactMessages: {
      total: contactTotal.count ?? 0,
      new: contactNew.count ?? 0,
    },
  };
}

export interface AdminCareerRow {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  typicalSalaryMin: number | null;
  typicalSalaryMax: number | null;
  salaryCurrency: string | null;
  isActive: boolean;
  skillCount: number;
}

function mapCareerRow(row: any): AdminCareerRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description ?? null,
    description: row.description ?? null,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    typicalSalaryMin: row.typical_salary_min ?? null,
    typicalSalaryMax: row.typical_salary_max ?? null,
    salaryCurrency: row.salary_currency ?? null,
    isActive: row.is_active,
    skillCount: (row.career_skills as any[] | null)?.length ?? 0,
  };
}

export async function listAdminCareers(
  rlsClient: Client,
  userId: string,
): Promise<AdminCareerRow[]> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("careers")
    .select(
      "id, slug, title, short_description, description, seo_title, seo_description, typical_salary_min, typical_salary_max, salary_currency, is_active, career_skills(id)",
    )
    .order("title");
  if (error) throw new Error("Unable to load careers.");
  return (data ?? []).map(mapCareerRow);
}

export interface CareerInput {
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  typicalSalaryMin: number | null;
  typicalSalaryMax: number | null;
  salaryCurrency: string | null;
}

function careerInputToRow(input: CareerInput) {
  return {
    slug: input.slug,
    title: input.title,
    short_description: input.shortDescription,
    description: input.description,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    typical_salary_min: input.typicalSalaryMin,
    typical_salary_max: input.typicalSalaryMax,
    salary_currency: input.salaryCurrency,
  };
}

/** Creates a new career. Slug uniqueness is enforced by the existing
 * `careers.slug` UNIQUE constraint — a collision surfaces as a clear,
 * actionable error rather than a generic failure. */
export async function createCareer(
  rlsClient: Client,
  userId: string,
  input: CareerInput,
): Promise<AdminCareerRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("careers")
    .insert(careerInputToRow(input))
    .select(
      "id, slug, title, short_description, description, seo_title, seo_description, typical_salary_min, typical_salary_max, salary_currency, is_active, career_skills(id)",
    )
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error(`A career with slug "${input.slug}" already exists.`);
    throw new Error("Unable to create this career.");
  }
  return mapCareerRow(data);
}

export async function updateCareer(
  rlsClient: Client,
  userId: string,
  careerId: string,
  input: CareerInput,
): Promise<AdminCareerRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("careers")
    .update(careerInputToRow(input))
    .eq("id", careerId)
    .select(
      "id, slug, title, short_description, description, seo_title, seo_description, typical_salary_min, typical_salary_max, salary_currency, is_active, career_skills(id)",
    )
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error(`A career with slug "${input.slug}" already exists.`);
    throw new Error("Unable to update this career.");
  }
  return mapCareerRow(data);
}

export async function setCareerActive(
  rlsClient: Client,
  userId: string,
  careerId: string,
  isActive: boolean,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("careers")
    .update({ is_active: isActive })
    .eq("id", careerId);
  if (error) throw new Error("Unable to update this career.");
  return { ok: true };
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  fullName: string | null;
  targetRole: string | null;
  isAdmin: boolean;
  createdAt: string | null;
  plan: PlanTier;
  planSource: "default" | "manual_admin";
  planUpdatedAt: string | null;
}

export async function listAdminUsers(rlsClient: Client, userId: string): Promise<AdminUserRow[]> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profiles, error: pError }, { data: roles, error: rError }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, target_role, created_at, plan, plan_source, plan_updated_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "admin"),
  ]);
  if (pError) throw new Error("Unable to load users.");
  if (rError) throw new Error("Unable to load user roles.");

  const adminIds = new Set(((roles ?? []) as any[]).map((r) => r.user_id));
  return ((profiles ?? []) as any[]).map((p) => ({
    id: p.id,
    email: p.email ?? null,
    fullName: p.full_name ?? null,
    targetRole: p.target_role ?? null,
    isAdmin: adminIds.has(p.id),
    createdAt: p.created_at ?? null,
    plan: (p.plan ?? "free") as PlanTier,
    planSource: (p.plan_source ?? "default") as "default" | "manual_admin",
    planUpdatedAt: p.plan_updated_at ?? null,
  }));
}

/**
 * Manually assigns a plan to a user — the only way plans change in Phase 1,
 * ahead of real payment integration. Always goes through the service-role
 * client after requireAdmin() passes; the client-writable columns on
 * profiles never include `plan` (see the Phase 1 migration), so this is the
 * only code path that can change it. Always labels the result
 * 'manual_admin' so the UI never implies an active paid subscription.
 */
export async function setUserPlan(
  rlsClient: Client,
  callerId: string,
  targetUserId: string,
  newPlan: PlanTier,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, callerId);
  if (!PLAN_TIERS.includes(newPlan)) throw new Error("Invalid plan.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan: newPlan,
      plan_source: "manual_admin",
      plan_updated_at: new Date().toISOString(),
      plan_updated_by: callerId,
    })
    .eq("id", targetUserId);
  if (error) throw new Error("Unable to update this user's plan.");
  return { ok: true };
}

/**
 * Grants or revokes the admin role for a user. A caller can never revoke
 * their own admin access through this function — that would risk locking
 * every admin out of the panel with no server-side way back in.
 */
export async function setUserAdminRole(
  rlsClient: Client,
  callerId: string,
  targetUserId: string,
  makeAdmin: boolean,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, callerId);
  if (targetUserId === callerId) {
    throw new Error("You cannot change your own admin access.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (makeAdmin) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error("Unable to grant admin access.");
  } else {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("role", "admin");
    if (error) throw new Error("Unable to revoke admin access.");
  }
  return { ok: true };
}

export interface AdminCatalogSummary {
  assessments: AdminAssessmentRow[];
  projects: AdminProjectRow[];
  resources: AdminResourceRow[];
}

export interface AdminAssessmentRow {
  id: string;
  slug: string;
  title: string;
  skillId: string | null;
  difficulty: string;
  description: string | null;
  passScore: number;
  questionCount: number;
}

export interface AdminProjectRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  difficulty: string;
  estimatedHours: number;
  careerId: string | null;
  skills: string[];
  datasetSuggestion: string | null;
  requirements: string[];
  expectedOutput: string | null;
  readmeOutline: string[];
  resumeBullet: string | null;
}

export interface AdminResourceRow {
  id: string;
  title: string;
  provider: string | null;
  url: string;
  type: string;
  skillId: string | null;
  careerId: string | null;
  isFree: boolean;
  estimatedHours: number | null;
  description: string | null;
}

/** Read-only inspection lists for the admin catalog view. */
export async function listAdminCatalog(
  rlsClient: Client,
  userId: string,
): Promise<AdminCatalogSummary> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: assessments }, { data: projects }, { data: resources }] = await Promise.all([
    supabaseAdmin
      .from("assessments")
      .select(
        "id, slug, title, skill_id, difficulty, description, pass_score, assessment_questions(id)",
      )
      .order("title"),
    supabaseAdmin
      .from("projects")
      .select(
        "id, slug, title, summary, difficulty, estimated_hours, career_id, skills, dataset_suggestion, requirements, expected_output, readme_outline, resume_bullet",
      )
      .order("title"),
    supabaseAdmin
      .from("resources")
      .select(
        "id, title, provider, url, type, skill_id, career_id, is_free, estimated_hours, description",
      )
      .order("title"),
  ]);

  return {
    assessments: ((assessments ?? []) as any[]).map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      skillId: a.skill_id ?? null,
      difficulty: a.difficulty,
      description: a.description ?? null,
      passScore: a.pass_score,
      questionCount: (a.assessment_questions as any[] | null)?.length ?? 0,
    })),
    projects: ((projects ?? []) as any[]).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary ?? null,
      difficulty: p.difficulty,
      estimatedHours: p.estimated_hours,
      careerId: p.career_id ?? null,
      skills: p.skills ?? [],
      datasetSuggestion: p.dataset_suggestion ?? null,
      requirements: p.requirements ?? [],
      expectedOutput: p.expected_output ?? null,
      readmeOutline: p.readme_outline ?? [],
      resumeBullet: p.resume_bullet ?? null,
    })),
    resources: ((resources ?? []) as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      provider: r.provider ?? null,
      url: r.url,
      type: r.type,
      skillId: r.skill_id ?? null,
      careerId: r.career_id ?? null,
      isFree: r.is_free,
      estimatedHours: r.estimated_hours ?? null,
      description: r.description ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Resources — simplest catalog entity (no nested children), full CRUD.
// ---------------------------------------------------------------------------

export interface ResourceInput {
  title: string;
  provider: string | null;
  url: string;
  type: "documentation" | "course" | "video" | "book" | "practice" | "project";
  skillId: string | null;
  careerId: string | null;
  isFree: boolean;
  estimatedHours: number | null;
  description: string | null;
}

function resourceInputToRow(input: ResourceInput) {
  return {
    title: input.title,
    provider: input.provider,
    url: input.url,
    type: input.type,
    skill_id: input.skillId,
    career_id: input.careerId,
    is_free: input.isFree,
    estimated_hours: input.estimatedHours,
    description: input.description,
  };
}

const RESOURCE_SELECT =
  "id, title, provider, url, type, skill_id, career_id, is_free, estimated_hours, description";

function mapResourceRow(row: any): AdminResourceRow {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider ?? null,
    url: row.url,
    type: row.type,
    skillId: row.skill_id ?? null,
    careerId: row.career_id ?? null,
    isFree: row.is_free,
    estimatedHours: row.estimated_hours ?? null,
    description: row.description ?? null,
  };
}

export async function createResource(
  rlsClient: Client,
  userId: string,
  input: ResourceInput,
): Promise<AdminResourceRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("resources")
    .insert(resourceInputToRow(input))
    .select(RESOURCE_SELECT)
    .single();
  if (error) throw new Error("Unable to create this resource.");
  return mapResourceRow(data);
}

export async function updateResource(
  rlsClient: Client,
  userId: string,
  resourceId: string,
  input: ResourceInput,
): Promise<AdminResourceRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("resources")
    .update(resourceInputToRow(input))
    .eq("id", resourceId)
    .select(RESOURCE_SELECT)
    .single();
  if (error) throw new Error("Unable to update this resource.");
  return mapResourceRow(data);
}

/** Resources have no `is_active` column and nothing else references them by
 * FK (unlike careers, which projects/resources point back to), so a real
 * delete is the correct, schema-consistent action here -- there is no
 * "archive" state to prefer. The UI requires a confirmation step first. */
export async function deleteResource(
  rlsClient: Client,
  userId: string,
  resourceId: string,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("resources").delete().eq("id", resourceId);
  if (error) throw new Error("Unable to delete this resource.");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Projects — top-level fields only. `requirements`/`skills`/`readme_outline`
// are edited as one-item-per-line text, matching their TEXT[] storage.
// ---------------------------------------------------------------------------

export interface ProjectInput {
  slug: string;
  title: string;
  summary: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedHours: number;
  careerId: string | null;
  skills: string[];
  datasetSuggestion: string | null;
  requirements: string[];
  expectedOutput: string | null;
  readmeOutline: string[];
  resumeBullet: string | null;
}

function projectInputToRow(input: ProjectInput) {
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    difficulty: input.difficulty,
    estimated_hours: input.estimatedHours,
    career_id: input.careerId,
    skills: input.skills,
    dataset_suggestion: input.datasetSuggestion,
    requirements: input.requirements,
    expected_output: input.expectedOutput,
    readme_outline: input.readmeOutline,
    resume_bullet: input.resumeBullet,
  };
}

const PROJECT_SELECT =
  "id, slug, title, summary, difficulty, estimated_hours, career_id, skills, dataset_suggestion, requirements, expected_output, readme_outline, resume_bullet";

function mapProjectRow(row: any): AdminProjectRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    difficulty: row.difficulty,
    estimatedHours: row.estimated_hours,
    careerId: row.career_id ?? null,
    skills: row.skills ?? [],
    datasetSuggestion: row.dataset_suggestion ?? null,
    requirements: row.requirements ?? [],
    expectedOutput: row.expected_output ?? null,
    readmeOutline: row.readme_outline ?? [],
    resumeBullet: row.resume_bullet ?? null,
  };
}

export async function createProject(
  rlsClient: Client,
  userId: string,
  input: ProjectInput,
): Promise<AdminProjectRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert(projectInputToRow(input))
    .select(PROJECT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error(`A project with slug "${input.slug}" already exists.`);
    throw new Error("Unable to create this project.");
  }
  return mapProjectRow(data);
}

export async function updateProject(
  rlsClient: Client,
  userId: string,
  projectId: string,
  input: ProjectInput,
): Promise<AdminProjectRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(projectInputToRow(input))
    .eq("id", projectId)
    .select(PROJECT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error(`A project with slug "${input.slug}" already exists.`);
    throw new Error("Unable to update this project.");
  }
  return mapProjectRow(data);
}

/** Projects have no archive flag, and `user_projects.project_id` cascades
 * on delete -- deleting a project a user has started would silently wipe
 * their progress record. Block that instead of letting it happen quietly,
 * and point the admin at editing (or deactivating via the catalog) rather
 * than deleting. */
export async function deleteProject(
  rlsClient: Client,
  userId: string,
  projectId: string,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_projects")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) > 0) {
    throw new Error(
      `This project can't be deleted: ${count} user(s) have already started it. Remove it from the catalog by editing it instead, or contact engineering to archive it safely.`,
    );
  }
  const { error } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
  if (error) throw new Error("Unable to delete this project.");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assessments — top-level fields only. Question editing (assessment_questions)
// is intentionally out of scope for this UI; questionCount is shown so an
// admin can see whether a newly created assessment still needs questions
// added via a migration/seed script.
// ---------------------------------------------------------------------------

export interface AssessmentInput {
  slug: string;
  title: string;
  skillId: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  description: string | null;
  passScore: number;
}

function assessmentInputToRow(input: AssessmentInput) {
  return {
    slug: input.slug,
    title: input.title,
    skill_id: input.skillId,
    difficulty: input.difficulty,
    description: input.description,
    pass_score: input.passScore,
  };
}

const ASSESSMENT_SELECT =
  "id, slug, title, skill_id, difficulty, description, pass_score, assessment_questions(id)";

function mapAssessmentRow(row: any): AdminAssessmentRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    skillId: row.skill_id ?? null,
    difficulty: row.difficulty,
    description: row.description ?? null,
    passScore: row.pass_score,
    questionCount: (row.assessment_questions as any[] | null)?.length ?? 0,
  };
}

export async function createAssessment(
  rlsClient: Client,
  userId: string,
  input: AssessmentInput,
): Promise<AdminAssessmentRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("assessments")
    .insert(assessmentInputToRow(input))
    .select(ASSESSMENT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error(`An assessment with slug "${input.slug}" already exists.`);
    throw new Error("Unable to create this assessment.");
  }
  return mapAssessmentRow(data);
}

export async function updateAssessment(
  rlsClient: Client,
  userId: string,
  assessmentId: string,
  input: AssessmentInput,
): Promise<AdminAssessmentRow> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("assessments")
    .update(assessmentInputToRow(input))
    .eq("id", assessmentId)
    .select(ASSESSMENT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error(`An assessment with slug "${input.slug}" already exists.`);
    throw new Error("Unable to update this assessment.");
  }
  return mapAssessmentRow(data);
}

/** Blocks deletion if anyone has already attempted it -- `assessment_id`
 * cascades on delete, so removing an attempted assessment would silently
 * wipe users' `assessment_attempts` history. */
export async function deleteAssessment(
  rlsClient: Client,
  userId: string,
  assessmentId: string,
): Promise<{ ok: true }> {
  await requireAdmin(rlsClient, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("assessment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);
  if ((count ?? 0) > 0) {
    throw new Error(
      `This assessment can't be deleted: ${count} attempt(s) already exist against it.`,
    );
  }
  const { error } = await supabaseAdmin.from("assessments").delete().eq("id", assessmentId);
  if (error) throw new Error("Unable to delete this assessment.");
  return { ok: true };
}
