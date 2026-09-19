import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareerSkillRow, MarketIntelligence } from "@/lib/catalog-types";

interface JobRow {
  id: string;
  is_demo: boolean;
  work_mode: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  experience_years_min: number | null;
}

/**
 * Market intelligence is derived only from job rows stored in the database.
 * If every contributing posting is flagged as demo data the result is labelled
 * "demo" — sample numbers are never presented as live market statistics.
 */
export async function computeMarket(
  supabase: SupabaseClient<never, never, never>,
  careerId: string,
  skills: CareerSkillRow[],
): Promise<MarketIntelligence> {
  const { data } = await supabase
    .from("jobs")
    .select("id, is_demo, work_mode, location, salary_min, salary_max, experience_years_min")
    .eq("career_id", careerId);

  const rows = (data ?? []) as unknown as JobRow[];
  const liveRows = rows.filter((r) => !r.is_demo);
  const dataMode: "demo" | "live" = liveRows.length > 0 ? "live" : "demo";
  const scoped = dataMode === "live" ? liveRows : rows;

  const locations = new Map<string, number>();
  for (const row of scoped) {
    const key = row.location ?? "Unspecified";
    locations.set(key, (locations.get(key) ?? 0) + 1);
  }

  const experiences = scoped
    .map((r) => r.experience_years_min)
    .filter((v): v is number => v !== null);
  const salaryMins = scoped.map((r) => r.salary_min).filter((v): v is number => v !== null);
  const salaryMaxes = scoped.map((r) => r.salary_max).filter((v): v is number => v !== null);

  return {
    dataMode,
    jobsAnalyzed: scoped.length,
    avgExperienceYears: experiences.length
      ? Math.round((experiences.reduce((a, b) => a + b, 0) / experiences.length) * 10) / 10
      : null,
    salaryMin: salaryMins.length ? Math.min(...salaryMins) : null,
    salaryMax: salaryMaxes.length ? Math.max(...salaryMaxes) : null,
    remoteShare: scoped.length
      ? Math.round((scoped.filter((r) => r.work_mode === "remote").length / scoped.length) * 100)
      : 0,
    topLocations: [...locations.entries()]
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topSkills: skills
      .filter((s) => s.demandPercentage !== null)
      .sort((a, b) => (b.demandPercentage ?? 0) - (a.demandPercentage ?? 0))
      .slice(0, 6)
      .map((s) => ({ name: s.name, percentage: s.demandPercentage ?? 0 })),
  };
}
