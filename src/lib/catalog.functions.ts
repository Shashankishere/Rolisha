import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CareerDetail, CareerSkillRow, CareerSummary } from "@/lib/catalog-types";
import type { ProficiencyLevel, SkillImportance } from "@/lib/domain";

export const listCareers = createServerFn({ method: "GET" }).handler(
  async (): Promise<CareerSummary[]> => {
    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const supabase = createPublicServerClient();
    const { data, error } = await supabase
      .from("careers")
      .select(
        "id, slug, title, short_description, typical_salary_min, typical_salary_max, salary_currency, career_skills(id)",
      )
      .eq("is_active", true)
      .order("title");
    if (error) throw new Error("Unable to load career paths right now.");
    return (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.short_description,
      salaryMin: row.typical_salary_min,
      salaryMax: row.typical_salary_max,
      currency: row.salary_currency ?? null,
      skillCount: (row.career_skills as { id: string }[] | null)?.length ?? 0,
    }));
  },
);

export const getCareerDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data }): Promise<CareerDetail | null> => {
    const { createPublicServerClient } = await import("@/lib/supabase-public.server");
    const { computeMarket } = await import("@/lib/market.server");
    const supabase = createPublicServerClient();

    const { data: career, error } = await supabase
      .from("careers")
      .select(
        "id, slug, title, short_description, description, seo_title, seo_description, typical_salary_min, typical_salary_max, salary_currency",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Unable to load this career path right now.");
    if (!career) return null;

    const [{ data: careerSkills }, { data: projects }] = await Promise.all([
      supabase
        .from("career_skills")
        .select(
          "skill_id, importance, required_level, demand_percentage, sort_order, skills(name, category)",
        )
        .eq("career_id", career.id)
        .order("sort_order"),
      supabase
        .from("projects")
        .select("slug, title, summary, difficulty")
        .eq("career_id", career.id),
    ]);

    const skills: CareerSkillRow[] = (careerSkills ?? []).map((row) => ({
      skillId: row.skill_id,
      name: (row.skills as { name: string } | null)?.name ?? "Skill",
      category: (row.skills as { category: string | null } | null)?.category ?? null,
      importance: row.importance as SkillImportance,
      requiredLevel: row.required_level as ProficiencyLevel,
      demandPercentage: row.demand_percentage,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const market = await computeMarket(supabase as any, career.id, skills);

    return {
      id: career.id,
      slug: career.slug,
      title: career.title,
      shortDescription: career.short_description,
      description: career.description,
      seoTitle: career.seo_title,
      seoDescription: career.seo_description,
      salaryMin: career.typical_salary_min,
      salaryMax: career.typical_salary_max,
      currency: career.salary_currency ?? null,
      skills,
      market,
      projects: projects ?? [],
    };
  });

export const listSkills = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicServerClient } = await import("@/lib/supabase-public.server");
  const supabase = createPublicServerClient();
  const { data, error } = await supabase.from("skills").select("id, name, category").order("name");
  if (error) throw new Error("Unable to load the skill catalogue right now.");
  return (data ?? []) as { id: string; name: string; category: string | null }[];
});
