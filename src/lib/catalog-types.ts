import type { ProficiencyLevel, SkillImportance } from "@/lib/domain";

export interface CareerSummary {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  skillCount: number;
}

export interface CareerSkillRow {
  skillId: string;
  name: string;
  category: string | null;
  importance: SkillImportance;
  requiredLevel: ProficiencyLevel;
  demandPercentage: number | null;
}

export interface MarketIntelligence {
  dataMode: "demo" | "live";
  jobsAnalyzed: number;
  avgExperienceYears: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  remoteShare: number;
  topLocations: { location: string; count: number }[];
  topSkills: { name: string; percentage: number }[];
}

export interface CareerDetail {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  skills: CareerSkillRow[];
  market: MarketIntelligence;
  projects: { slug: string; title: string; summary: string | null; difficulty: string }[];
}
