/**
 * Bridges the normalized jobs/job_skills schema to the existing, unmodified
 * `scoreJobMatch()` in `@/lib/domain`. This file is intentionally "dumb" —
 * all product/scoring logic stays in domain.ts; this only reshapes data.
 */
import {
  scoreJobMatch,
  type EducationLevel,
  type MatchBreakdown,
  type MatchInput,
  type ProficiencyLevel,
  type WorkMode,
} from "@/lib/domain";
import { loadProfile, loadUserSkills } from "@/lib/me.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export interface JobForMatch {
  id: string;
  title: string;
  company: string;
  workMode: WorkMode | null;
  country: string | null;
  salaryMax: number | null;
  experienceYearsMin: number | null;
  educationRequirement: EducationLevel | null;
  requiredSkillIds: string[];
}

export async function loadJobForMatch(supabase: Client, jobId: string): Promise<JobForMatch> {
  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, title, company, work_mode, country, salary_max, experience_years_min, education_requirement",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this job.");
  if (!job) throw new Error("Job not found.");

  const { data: jobSkills, error: skillsError } = await supabase
    .from("job_skills")
    .select("skill_id")
    .eq("job_id", jobId);
  if (skillsError) throw new Error("Unable to load this job's required skills.");

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    workMode: job.work_mode as WorkMode | null,
    country: job.country,
    salaryMax: job.salary_max === null ? null : Number(job.salary_max),
    experienceYearsMin: job.experience_years_min,
    educationRequirement: job.education_requirement as EducationLevel | null,
    requiredSkillIds: (jobSkills ?? []).map((row: { skill_id: string }) => row.skill_id),
  };
}

/** Pure reshape: DB job + user context -> scoreJobMatch()'s MatchInput. */
export function toMatchInput(
  job: JobForMatch,
  userLevels: Record<string, ProficiencyLevel>,
  userExperience: MatchInput["userExperience"],
  userEducation: EducationLevel | null,
  userWorkMode: WorkMode | null,
  userCountry: string | null,
  userSalaryTarget: number | null,
): MatchInput {
  return {
    jobSkillIds: job.requiredSkillIds,
    userLevels,
    jobExperienceYearsMin: job.experienceYearsMin,
    userExperience,
    jobEducation: job.educationRequirement,
    userEducation,
    jobWorkMode: job.workMode,
    userWorkMode,
    jobCountry: job.country,
    userCountry,
    jobSalaryMax: job.salaryMax,
    userSalaryTarget,
  };
}

/** Computes (without persisting) the current user's match against one job. */
export async function calculateJobMatch(
  supabase: Client,
  userId: string,
  jobId: string,
): Promise<MatchBreakdown & { jobId: string }> {
  const [profile, skills, job] = await Promise.all([
    loadProfile(supabase, userId),
    loadUserSkills(supabase, userId),
    loadJobForMatch(supabase, jobId),
  ]);

  const userLevels: Record<string, ProficiencyLevel> = {};
  for (const skill of skills) if (skill.skillId) userLevels[skill.skillId] = skill.level;

  const input = toMatchInput(
    job,
    userLevels,
    profile.experience,
    profile.educationLevel,
    profile.workMode,
    profile.country,
    profile.salaryTarget,
  );

  return { ...scoreJobMatch(input), jobId };
}

/**
 * Batch-loads jobs + their required skills for a set of job IDs in two
 * queries total (not N+1), for the Jobs Explorer list/scoring path.
 */
export async function loadJobsForMatch(
  supabase: Client,
  jobIds: string[],
): Promise<Map<string, JobForMatch>> {
  const result = new Map<string, JobForMatch>();
  if (jobIds.length === 0) return result;

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(
      "id, title, company, work_mode, country, salary_max, experience_years_min, education_requirement",
    )
    .in("id", jobIds);
  if (error) throw new Error("Unable to load jobs.");

  const { data: jobSkills, error: skillsError } = await supabase
    .from("job_skills")
    .select("job_id, skill_id")
    .in("job_id", jobIds);
  if (skillsError) throw new Error("Unable to load job skills.");

  const skillsByJob = new Map<string, string[]>();
  for (const row of (jobSkills ?? []) as { job_id: string; skill_id: string }[]) {
    const list = skillsByJob.get(row.job_id) ?? [];
    list.push(row.skill_id);
    skillsByJob.set(row.job_id, list);
  }

  for (const job of (jobs ?? []) as any[]) {
    result.set(job.id, {
      id: job.id,
      title: job.title,
      company: job.company,
      workMode: job.work_mode as WorkMode | null,
      country: job.country,
      salaryMax: job.salary_max === null ? null : Number(job.salary_max),
      experienceYearsMin: job.experience_years_min,
      educationRequirement: job.education_requirement as EducationLevel | null,
      requiredSkillIds: skillsByJob.get(job.id) ?? [],
    });
  }
  return result;
}

/**
 * Scores many jobs against one user's profile in a single pass — loads the
 * user's profile/skills once, then reshapes+scores each job in memory using
 * the same, unmodified `scoreJobMatch()`. Used by the Jobs Explorer list so
 * "Best Match" sorting and per-card match percentages don't require N+1
 * requests to the user's profile.
 */
export async function calculateJobMatchesBatch(
  supabase: Client,
  userId: string,
  jobs: JobForMatch[],
): Promise<Map<string, MatchBreakdown>> {
  const result = new Map<string, MatchBreakdown>();
  if (jobs.length === 0) return result;

  const [profile, skills] = await Promise.all([
    loadProfile(supabase, userId),
    loadUserSkills(supabase, userId),
  ]);

  const userLevels: Record<string, ProficiencyLevel> = {};
  for (const skill of skills) if (skill.skillId) userLevels[skill.skillId] = skill.level;

  for (const job of jobs) {
    const input = toMatchInput(
      job,
      userLevels,
      profile.experience,
      profile.educationLevel,
      profile.workMode,
      profile.country,
      profile.salaryTarget,
    );
    result.set(job.id, scoreJobMatch(input));
  }
  return result;
}

/** Computes and upserts the match so it can be listed without recomputation. */
export async function saveJobMatch(
  supabase: Client,
  userId: string,
  jobId: string,
): Promise<MatchBreakdown & { jobId: string }> {
  const result = await calculateJobMatch(supabase, userId, jobId);
  const { error } = await supabase.from("job_matches").upsert(
    {
      user_id: userId,
      job_id: jobId,
      overall_score: result.overall,
      skills_score: result.skills,
      experience_score: result.experience,
      education_score: result.education,
      location_score: result.location,
      salary_score: result.salary,
      matched_skill_ids: result.matchedSkillIds,
      missing_skill_ids: result.missingSkillIds,
    },
    { onConflict: "user_id,job_id" },
  );
  if (error) throw new Error("Unable to save this job match.");
  return result;
}
