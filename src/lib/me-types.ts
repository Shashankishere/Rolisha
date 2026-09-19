import type {
  EducationLevel,
  ExperienceLevel,
  ProficiencyLevel,
  SkillGapRow,
  WorkMode,
} from "@/lib/domain";

export interface MyProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  targetRole: string | null;
  careerId: string | null;
  careerSlug: string | null;
  educationLevel: EducationLevel | null;
  degree: string | null;
  fieldOfStudy: string | null;
  graduationYear: number | null;
  experience: ExperienceLevel;
  hoursPerWeek: number;
  salaryTarget: number | null;
  salaryCurrency: string;
  country: string | null;
  city: string | null;
  workMode: WorkMode;
  plan: string;
  onboardingCompleted: boolean;
  isAdmin: boolean;
}

export interface MySkill {
  skillId: string | null;
  customName: string | null;
  name: string;
  level: ProficiencyLevel;
  source: string;
}

export interface RoadmapTaskView {
  id: string;
  monthId: string;
  weekNumber: number;
  title: string;
  description: string | null;
  skillName: string | null;
  estimatedHours: number;
  isCompleted: boolean;
}

export interface RoadmapMonthView {
  id: string;
  monthNumber: number;
  title: string;
  /** True when this month's full detail is hidden behind a plan gate. Locked
   * months only carry `id`, `monthNumber`, `title`, and `estimatedHours` —
   * every other field is nulled out server-side, not just hidden in the UI. */
  locked: boolean;
  goal: string | null;
  topics: string[];
  skills: string[];
  estimatedHours: number;
  projectTitle: string | null;
  projectDescription: string | null;
  milestone: string | null;
  assessmentSkill: string | null;
  tasks: RoadmapTaskView[];
}

export interface RoadmapView {
  id: string;
  targetRole: string;
  summary: string | null;
  hoursPerWeek: number;
  readinessScore: number;
  dataMode: string;
  jobsAnalyzed: number;
  createdAt: string;
  months: RoadmapMonthView[];
  /** Total months in the generated plan, including locked ones — lets the
   * UI say "3 of 6 months unlocked" even though `months` only carries full
   * detail for the unlocked ones. */
  totalMonths: number;
}

export interface ProgressEventView {
  id: string;
  eventType: string;
  label: string | null;
  readinessScore: number | null;
  createdAt: string;
}

export interface Workspace {
  profile: MyProfile;
  skills: MySkill[];
  gaps: SkillGapRow[];
  readiness: number;
  roadmap: RoadmapView | null;
  events: ProgressEventView[];
}
