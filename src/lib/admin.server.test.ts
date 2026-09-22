import { describe, expect, it } from "vitest";
import {
  createAssessment,
  createCareer,
  createProject,
  createResource,
  deleteAssessment,
  deleteProject,
  deleteResource,
  getAdminOverview,
  listAdminCareers,
  listAdminCatalog,
  listAdminUsers,
  setCareerActive,
  setUserAdminRole,
  setUserPlan,
  updateAssessment,
  updateCareer,
  updateProject,
  updateResource,
} from "@/lib/admin.server";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

// These tests only exercise the requireAdmin gate: every admin.server export
// checks the caller's own role (via the RLS-scoped client) before ever
// reaching the service-role client, so a non-admin caller must be rejected
// without needing real Supabase credentials in the test environment. The
// admin-success paths (actual service-role reads/writes) are not covered
// here — they require a live Supabase project and were verified by code
// review and manual testing instead; see the final report.
describe("admin.server requireAdmin gating", () => {
  it("getAdminOverview rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(getAdminOverview(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("getAdminOverview rejects a caller with no role row at all", async () => {
    const fake = createFakeSupabase();
    await expect(getAdminOverview(fake, USER_A)).rejects.toThrow(/forbidden/i);
  });

  it("listAdminCareers rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(listAdminCareers(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("setCareerActive rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(setCareerActive(fake, USER_B, "career-1", true)).rejects.toThrow(/forbidden/i);
  });

  it("listAdminUsers rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(listAdminUsers(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("listAdminCatalog rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(listAdminCatalog(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("setUserAdminRole rejects a non-admin caller before checking anything else", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(setUserAdminRole(fake, USER_B, USER_A, true)).rejects.toThrow(/forbidden/i);
  });

  it("setUserAdminRole refuses to let an admin change their own role, even before touching the database", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    await expect(setUserAdminRole(fake, USER_A, USER_A, false)).rejects.toThrow(
      /cannot change your own admin access/i,
    );
  });

  it("setUserPlan rejects a non-admin caller before touching any plan data", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(setUserPlan(fake, USER_B, USER_A, "pro")).rejects.toThrow(/forbidden/i);
  });

  it("setUserPlan rejects a caller with no role row at all", async () => {
    const fake = createFakeSupabase();
    await expect(setUserPlan(fake, USER_A, USER_A, "pro")).rejects.toThrow(/forbidden/i);
  });

  it("setUserPlan rejects an invalid plan value even for an admin", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    await expect(setUserPlan(fake, USER_A, USER_B, "enterprise" as never)).rejects.toThrow(
      /invalid plan/i,
    );
  });

  it("setUserPlan rejects 'premium' -- Premium was folded into Pro and is no longer a valid plan an admin can assign", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    await expect(setUserPlan(fake, USER_A, USER_B, "premium" as never)).rejects.toThrow(
      /invalid plan/i,
    );
  });

  // --- Careers CRUD (Phase 4.5) ---------------------------------------------
  const CAREER_INPUT = {
    slug: "test-role",
    title: "Test Role",
    shortDescription: null,
    description: null,
    seoTitle: null,
    seoDescription: null,
    typicalSalaryMin: null,
    typicalSalaryMax: null,
    salaryCurrency: null,
  };

  it("createCareer rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(createCareer(fake, USER_B, CAREER_INPUT)).rejects.toThrow(/forbidden/i);
  });

  it("updateCareer rejects a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(updateCareer(fake, USER_B, "career-1", CAREER_INPUT)).rejects.toThrow(
      /forbidden/i,
    );
  });

  it("createCareer and updateCareer reject a caller with no role row at all", async () => {
    const fake = createFakeSupabase();
    await expect(createCareer(fake, USER_A, CAREER_INPUT)).rejects.toThrow(/forbidden/i);
    await expect(updateCareer(fake, USER_A, "career-1", CAREER_INPUT)).rejects.toThrow(
      /forbidden/i,
    );
  });

  // --- Catalog CRUD (Phase 4.5): resources / projects / assessments --------
  const RESOURCE_INPUT = {
    title: "Test Resource",
    provider: null,
    url: "https://example.com",
    type: "documentation" as const,
    skillId: null,
    careerId: null,
    isFree: true,
    estimatedHours: null,
    description: null,
  };

  it("createResource / updateResource / deleteResource reject a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(createResource(fake, USER_B, RESOURCE_INPUT)).rejects.toThrow(/forbidden/i);
    await expect(updateResource(fake, USER_B, "res-1", RESOURCE_INPUT)).rejects.toThrow(
      /forbidden/i,
    );
    await expect(deleteResource(fake, USER_B, "res-1")).rejects.toThrow(/forbidden/i);
  });

  const PROJECT_INPUT = {
    slug: "test-project",
    title: "Test Project",
    summary: null,
    difficulty: "beginner" as const,
    estimatedHours: 5,
    careerId: null,
    skills: [],
    datasetSuggestion: null,
    requirements: [],
    expectedOutput: null,
    readmeOutline: [],
    resumeBullet: null,
  };

  it("createProject / updateProject / deleteProject reject a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(createProject(fake, USER_B, PROJECT_INPUT)).rejects.toThrow(/forbidden/i);
    await expect(updateProject(fake, USER_B, "proj-1", PROJECT_INPUT)).rejects.toThrow(
      /forbidden/i,
    );
    await expect(deleteProject(fake, USER_B, "proj-1")).rejects.toThrow(/forbidden/i);
  });

  const ASSESSMENT_INPUT = {
    slug: "test-assessment",
    title: "Test Assessment",
    skillId: null,
    difficulty: "beginner" as const,
    description: null,
    passScore: 70,
  };

  it("createAssessment / updateAssessment / deleteAssessment reject a non-admin caller", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(createAssessment(fake, USER_B, ASSESSMENT_INPUT)).rejects.toThrow(/forbidden/i);
    await expect(updateAssessment(fake, USER_B, "assess-1", ASSESSMENT_INPUT)).rejects.toThrow(
      /forbidden/i,
    );
    await expect(deleteAssessment(fake, USER_B, "assess-1")).rejects.toThrow(/forbidden/i);
  });

  it("every new catalog/career mutation also rejects a caller with no role row at all", async () => {
    const fake = createFakeSupabase();
    await expect(createResource(fake, USER_A, RESOURCE_INPUT)).rejects.toThrow(/forbidden/i);
    await expect(createProject(fake, USER_A, PROJECT_INPUT)).rejects.toThrow(/forbidden/i);
    await expect(createAssessment(fake, USER_A, ASSESSMENT_INPUT)).rejects.toThrow(/forbidden/i);
  });
});
