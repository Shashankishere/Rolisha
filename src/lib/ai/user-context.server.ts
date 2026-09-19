/**
 * Builds a plain-text summary of a user's REAL profile data (target role,
 * experience, skills, completed projects) for inclusion in AI prompts.
 *
 * Every Pro AI feature that says it uses "target role, skills, roadmap,
 * projects, resume" pulls that context from here instead of re-querying
 * ad hoc, so the guarantee is centralized in one place: nothing here is
 * invented -- fields are omitted (not guessed) when the user hasn't
 * provided them.
 */
import { loadProfile, loadRequiredSkills, loadUserSkills } from "@/lib/me.server";
import { listProjectsForUser } from "@/lib/projects.server";
import {
  EXPERIENCE_LABEL,
  EDUCATION_LABEL,
  type ExperienceLevel,
  type EducationLevel,
} from "@/lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export interface UserAiContext {
  targetRole: string | null;
  experienceLabel: string | null;
  educationLabel: string | null;
  skillNames: string[];
  requiredSkillNames: string[];
  completedProjectTitles: string[];
  startedProjectTitles: string[];
  hoursPerWeek: number;
}

export async function buildUserAiContext(supabase: Client, userId: string): Promise<UserAiContext> {
  const profile = await loadProfile(supabase, userId);
  const [skills, required, projects] = await Promise.all([
    loadUserSkills(supabase, userId),
    loadRequiredSkills(supabase, profile.careerId),
    listProjectsForUser(supabase, userId).catch(() => []),
  ]);

  return {
    targetRole: profile.targetRole,
    experienceLabel: profile.experience
      ? EXPERIENCE_LABEL[profile.experience as ExperienceLevel]
      : null,
    educationLabel: profile.educationLevel
      ? EDUCATION_LABEL[profile.educationLevel as EducationLevel]
      : null,
    skillNames: skills.map((s) => s.name),
    requiredSkillNames: required.map((r) => r.name),
    completedProjectTitles: projects.filter((p) => p.status === "completed").map((p) => p.title),
    startedProjectTitles: projects.filter((p) => p.status === "started").map((p) => p.title),
    hoursPerWeek: profile.hoursPerWeek,
  };
}

/** Renders the context as prompt-ready lines, omitting anything the user
 * hasn't actually provided rather than filling in a placeholder. */
export function formatUserContext(ctx: UserAiContext): string {
  const lines: string[] = [];
  if (ctx.targetRole) lines.push(`Target role: ${ctx.targetRole}`);
  if (ctx.experienceLabel) lines.push(`Experience level: ${ctx.experienceLabel}`);
  if (ctx.educationLabel) lines.push(`Education: ${ctx.educationLabel}`);
  if (ctx.skillNames.length > 0)
    lines.push(`Skills logged in profile: ${ctx.skillNames.join(", ")}`);
  if (ctx.requiredSkillNames.length > 0) {
    lines.push(`Skills typically required for this role: ${ctx.requiredSkillNames.join(", ")}`);
  }
  if (ctx.completedProjectTitles.length > 0) {
    lines.push(`Completed portfolio projects: ${ctx.completedProjectTitles.join(", ")}`);
  }
  if (ctx.startedProjectTitles.length > 0) {
    lines.push(`In-progress portfolio projects: ${ctx.startedProjectTitles.join(", ")}`);
  }
  if (lines.length === 0) {
    return "No profile data has been provided yet -- keep guidance general and note that a completed profile would sharpen it.";
  }
  return lines.join("\n");
}
