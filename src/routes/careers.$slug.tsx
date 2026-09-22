import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Briefcase, Globe2, MapPin, TrendingUp } from "lucide-react";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCareerDetail } from "@/lib/catalog.functions";
import { IMPORTANCE_LABEL, PROFICIENCY_LABEL, formatSalaryRange } from "@/lib/domain";

const careerQuery = (slug: string) =>
  queryOptions({
    queryKey: ["career", slug],
    queryFn: () => getCareerDetail({ data: { slug } }),
  });

export const Route = createFileRoute("/careers/$slug")({
  loader: async ({ context, params }) => {
    const career = await context.queryClient.ensureQueryData(careerQuery(params.slug));
    if (!career) throw notFound();
    return career;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Career path unavailable — Rolisha" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = loaderData.seoTitle ?? `${loaderData.title} skills & roadmap — Rolisha`;
    const description =
      loaderData.seoDescription ??
      loaderData.shortDescription ??
      `The skills, proficiency levels and six month roadmap for becoming a ${loaderData.title}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => (
    <MarketingPage>
      <PageHero title="This career path could not be loaded" subtitle="Please try again shortly." />
    </MarketingPage>
  ),
  component: CareerDetailPage,
});

function CareerDetailPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(careerQuery(slug));
  if (!data) return null;

  const { market } = data;
  const salaryRange =
    data.salaryMin !== null || data.salaryMax !== null
      ? formatSalaryRange(data.salaryMin, data.salaryMax, data.currency)
      : "Not published";

  return (
    <MarketingPage>
      <PageHero
        eyebrow="Career path"
        title={data.title}
        subtitle={data.shortDescription ?? undefined}
      >
        <Button asChild size="lg">
          <Link to="/auth" search={{ mode: "signup" }}>
            Build my {data.title} roadmap
          </Link>
        </Button>
      </PageHero>

      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-16 sm:px-6">
        {(data.description || salaryRange !== "Not published") && (
          <section className="max-w-3xl">
            <h2 className="text-2xl font-semibold">About this role</h2>
            {data.description && (
              <p className="text-muted-foreground mt-3 text-pretty">{data.description}</p>
            )}
            {/* Career-level typical compensation. This comes from the career's own
                profile, not from job postings, so it's real regardless of whether
                live market data exists below — it must never be hidden behind or
                folded into the job-market availability state further down. */}
            <div className="mt-4 flex items-center gap-2 text-sm">
              <TrendingUp className="text-primary size-4" />
              <span className="text-muted-foreground">Typical salary:</span>
              <span className="font-medium">{salaryRange}</span>
            </div>
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Market intelligence</h2>
            {market.dataMode === "live" && <Badge>Live job data</Badge>}
          </div>
          {market.dataMode === "live" ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Stat
                icon={Briefcase}
                label="Postings analysed"
                value={String(market.jobsAnalyzed)}
              />
              <Stat
                icon={Globe2}
                label="Remote availability"
                value={`${Math.round(market.remoteShare)}%`}
              />
              <Stat
                icon={MapPin}
                label="Top location"
                value={market.topLocations[0]?.location ?? "Not available"}
              />
            </div>
          ) : (
            <div className="panel mt-6 flex flex-col gap-1 p-6">
              <p className="font-medium">Market data unavailable</p>
              <p className="text-muted-foreground text-sm">
                Connect a job source to see live postings, demand and remote share for this role.
                The salary above is the role's typical range, not a job-market statistic.
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-semibold">Required skill profile</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Importance drives the weighting in your readiness score. Demand shows how often the
            skill appears in the analysed postings.
          </p>
          <div className="panel hover-lift mt-6 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Skills required for {data.title}</caption>
              <thead className="bg-surface text-muted-foreground text-xs uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">
                    Skill
                  </th>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">
                    Importance
                  </th>
                  <th scope="col" className="px-5 py-3 text-left font-semibold">
                    Required level
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    Demand
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.skills.map((skill) => (
                  <tr key={skill.skillId} className="border-border/70 border-t">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      {skill.name}
                    </th>
                    <td className="text-muted-foreground px-5 py-3">{skill.category ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={skill.importance === "critical" ? "default" : "secondary"}>
                        {IMPORTANCE_LABEL[skill.importance]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">{PROFICIENCY_LABEL[skill.requiredLevel]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {skill.demandPercentage === null ? "—" : `${skill.demandPercentage}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {data.projects.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold">Portfolio projects for this path</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((project) => (
                <article key={project.slug} className="panel hover-lift p-6">
                  <Badge variant="outline" className="capitalize">
                    {project.difficulty}
                  </Badge>
                  <h3 className="mt-3 text-base font-semibold">{project.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{project.summary}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </MarketingPage>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="panel hover-lift p-5">
      <Icon className="text-primary size-4" />
      <p className="text-muted-foreground mt-3 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="font-display mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
