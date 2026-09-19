import { describe, expect, it, vi } from "vitest";
import { deleteAccountCore, updateProfileCore } from "@/lib/settings.server";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

describe("updateProfileCore", () => {
  it("updates only the fields provided", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [
      { id: USER_A, full_name: "Old Name", target_role: "Data Analyst", hours_per_week: 10 },
    ]);

    await updateProfileCore(fake, USER_A, { hoursPerWeek: 20 });

    const profile = fake.table("profiles")[0];
    expect(profile).toMatchObject({
      full_name: "Old Name",
      target_role: "Data Analyst",
      hours_per_week: 20,
    });
  });

  it("never touches career_id, education, or onboarding_completed", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [
      {
        id: USER_A,
        career_id: "career-1",
        education_level: "bachelors",
        onboarding_completed: true,
      },
    ]);

    await updateProfileCore(fake, USER_A, { targetRole: "New Role" });

    const profile = fake.table("profiles")[0];
    expect(profile).toMatchObject({
      career_id: "career-1",
      education_level: "bachelors",
      onboarding_completed: true,
      target_role: "New Role",
    });
  });

  it("does not write anything when called with no fields", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [{ id: USER_A, full_name: "Unchanged" }]);
    await updateProfileCore(fake, USER_A, {});
    expect(fake.table("profiles")[0]).toMatchObject({ full_name: "Unchanged" });
  });

  it("only updates the calling user's row", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [
      { id: USER_A, target_role: "A's role" },
      { id: USER_B, target_role: "B's role" },
    ]);
    await updateProfileCore(fake, USER_A, { targetRole: "Updated" });

    expect(fake.table("profiles").find((r) => r["id"] === USER_A)).toMatchObject({
      target_role: "Updated",
    });
    expect(fake.table("profiles").find((r) => r["id"] === USER_B)).toMatchObject({
      target_role: "B's role",
    });
  });
});

function createFakeAdmin(fake: ReturnType<typeof createFakeSupabase>) {
  return {
    from: fake.from.bind(fake),
    auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) } },
  };
}

describe("deleteAccountCore", () => {
  it("deletes every row owned by the user across all listed tables, plus the profile and auth user", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [{ id: USER_A }]);
    fake.seed("user_skills", [{ id: "s1", user_id: USER_A }]);
    fake.seed("roadmaps", [{ id: "r1", user_id: USER_A }]);
    fake.seed("saved_jobs", [{ id: "sj1", user_id: USER_A }]);
    const admin = createFakeAdmin(fake);

    await deleteAccountCore(admin, USER_A);

    expect(fake.table("profiles")).toHaveLength(0);
    expect(fake.table("user_skills")).toHaveLength(0);
    expect(fake.table("roadmaps")).toHaveLength(0);
    expect(fake.table("saved_jobs")).toHaveLength(0);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(USER_A);
  });

  it("never deletes another user's rows", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [{ id: USER_A }, { id: USER_B }]);
    fake.seed("saved_jobs", [
      { id: "sj1", user_id: USER_A },
      { id: "sj2", user_id: USER_B },
    ]);
    const admin = createFakeAdmin(fake);

    await deleteAccountCore(admin, USER_A);

    expect(fake.table("profiles")).toEqual([{ id: USER_B }]);
    expect(fake.table("saved_jobs")).toEqual([{ id: "sj2", user_id: USER_B }]);
  });
});
