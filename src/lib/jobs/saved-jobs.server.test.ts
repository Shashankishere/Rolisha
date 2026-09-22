import { describe, expect, it } from "vitest";
import { saveJobCore, unsaveJobCore } from "@/lib/jobs/saved-jobs.server";
import { createFakeSupabase } from "./__tests__/fake-supabase";
import { USER_A, USER_B } from "./__tests__/fixtures";

const JOB_1 = "job-1";
const JOB_2 = "job-2";

describe("saveJobCore", () => {
  it("saves a job for the user", async () => {
    const fake = createFakeSupabase();
    const result = await saveJobCore(fake, USER_A, JOB_1);
    expect(result).toEqual({ ok: true });
    const saved = fake.table("saved_jobs");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ user_id: USER_A, job_id: JOB_1 });
  });

  it("saving the same job twice is idempotent (upsert on user_id+job_id)", async () => {
    const fake = createFakeSupabase();
    await saveJobCore(fake, USER_A, JOB_1);
    await saveJobCore(fake, USER_A, JOB_1);
    expect(fake.table("saved_jobs")).toHaveLength(1);
  });

  it("the same job can be independently saved by two different users", async () => {
    const fake = createFakeSupabase();
    await saveJobCore(fake, USER_A, JOB_1);
    await saveJobCore(fake, USER_B, JOB_1);
    expect(fake.table("saved_jobs")).toHaveLength(2);
  });
});

describe("unsaveJobCore", () => {
  it("unsaves a previously saved job", async () => {
    const fake = createFakeSupabase();
    await saveJobCore(fake, USER_A, JOB_1);
    await unsaveJobCore(fake, USER_A, JOB_1);
    expect(fake.table("saved_jobs")).toHaveLength(0);
  });

  it("unsaving a job that was never saved is a no-op, not an error", async () => {
    const fake = createFakeSupabase();
    await expect(unsaveJobCore(fake, USER_A, JOB_1)).resolves.toEqual({ ok: true });
    expect(fake.table("saved_jobs")).toHaveLength(0);
  });

  it("user A cannot unsave user B's saved job — the delete is scoped to the caller's own userId", async () => {
    const fake = createFakeSupabase();
    await saveJobCore(fake, USER_B, JOB_1);
    await unsaveJobCore(fake, USER_A, JOB_1); // A tries to remove B's saved job
    const saved = fake.table("saved_jobs");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ user_id: USER_B, job_id: JOB_1 });
  });

  it("unsaving one of the user's jobs does not affect their other saved jobs", async () => {
    const fake = createFakeSupabase();
    await saveJobCore(fake, USER_A, JOB_1);
    await saveJobCore(fake, USER_A, JOB_2);
    await unsaveJobCore(fake, USER_A, JOB_1);
    const saved = fake.table("saved_jobs");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ job_id: JOB_2 });
  });
});

describe("saved_jobs — cross-user isolation", () => {
  it("userId always comes from the function argument (the authenticated context in production), never from row data supplied by the caller", async () => {
    // This is a structural note as much as a test: saveJobCore/unsaveJobCore
    // take `userId` as an explicit parameter sourced from `context.userId`
    // in jobs.functions.ts (populated by requireSupabaseAuth from the
    // verified JWT), and there is no code path here that reads a userId out
    // of client-supplied `data`. Demonstrated behaviorally: saving as A and
    // as B never lets one see or remove the other's row.
    const fake = createFakeSupabase();
    await saveJobCore(fake, USER_A, JOB_1);
    await saveJobCore(fake, USER_B, JOB_2);
    await unsaveJobCore(fake, USER_B, JOB_1); // B attempts to unsave A's saved job
    const saved = fake.table("saved_jobs");
    expect(saved).toHaveLength(2);
    expect(saved.some((r) => r["user_id"] === USER_A && r["job_id"] === JOB_1)).toBe(true);
  });
});
