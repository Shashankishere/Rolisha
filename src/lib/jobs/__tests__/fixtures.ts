import type { FakeSupabase, Row } from "./fake-supabase";

export const SKILL_REACT = "11111111-1111-1111-1111-111111111111";
export const SKILL_SQL = "22222222-2222-2222-2222-222222222222";
export const SKILL_PYTHON = "33333333-3333-3333-3333-333333333333";
export const SKILL_AWS = "44444444-4444-4444-4444-444444444444";

export const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export function seedSkills(fake: FakeSupabase) {
  fake.seed("skills", [
    { id: SKILL_REACT, name: "React" },
    { id: SKILL_SQL, name: "SQL" },
    { id: SKILL_PYTHON, name: "Python" },
    { id: SKILL_AWS, name: "AWS" },
  ]);
}

export function makeJob(overrides: Partial<Row> = {}): Row {
  return {
    id: overrides["id"] ?? `job-${Math.random().toString(36).slice(2)}`,
    title: "Software Engineer",
    company: "Acme Corp",
    location: "Remote",
    country: "US",
    work_mode: "remote",
    salary_min: 90000,
    salary_max: 130000,
    salary_currency: "USD",
    posted_at: "2026-01-01T00:00:00Z",
    retrieved_at: "2026-01-01T00:00:00Z",
    is_demo: false,
    last_seen_at: "2026-01-01T00:00:00Z",
    is_active: true,
    source_url: null,
    experience_years_min: 2,
    education_requirement: null,
    career_id: null,
    description: "A great job.",
    job_sources: { name: "Demo Source" },
    ...overrides,
  };
}

export function seedProfile(fake: FakeSupabase, userId: string, overrides: Partial<Row> = {}) {
  const profiles = fake.table("profiles");
  profiles.push({
    id: userId,
    email: `${userId}@example.com`,
    full_name: "Test User",
    target_role: "Software Engineer",
    career_id: null,
    education_level: "bachelors",
    degree: null,
    field_of_study: null,
    graduation_year: null,
    experience: "2_5",
    hours_per_week: 10,
    salary_target: 120000,
    salary_currency: "USD",
    country: "US",
    city: null,
    work_mode: "remote",
    plan: "free",
    onboarding_completed: true,
    careers: null,
    ...overrides,
  });
}

export function seedUserSkills(
  fake: FakeSupabase,
  userId: string,
  skills: { skillId: string; level: string }[],
) {
  const rows = fake.table("user_skills");
  for (const s of skills) {
    rows.push({
      user_id: userId,
      skill_id: s.skillId,
      custom_skill_name: null,
      level: s.level,
      source: "self_reported",
      skills: { name: "Skill" },
    });
  }
}

export function seedJobSkills(
  fake: FakeSupabase,
  jobId: string,
  skills: { skillId: string; required: boolean }[],
) {
  const rows = fake.table("job_skills");
  for (const s of skills) {
    rows.push({
      job_id: jobId,
      skill_id: s.skillId,
      is_required: s.required,
      skills: { name: "Skill" },
    });
  }
}
