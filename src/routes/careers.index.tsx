import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Layers } from "lucide-react";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { Reveal } from "@/components/app/reveal";
import { listCareers } from "@/lib/catalog.functions";
import { formatSalaryRange } from "@/lib/domain";

const TITLE = "Career paths — Rolisha";
const DESCRIPTION =
  "Explore supported career paths, the skills each one requires and the typical salary range, then build a personalised six month roadmap.";

const careersQuery = queryOptions({
  queryKey: ["careers"],
  queryFn: () => listCareers(),
});

export const Route = createFileRoute("/careers/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(careersQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  errorComponent: () => (
    <MarketingPage>
      <PageHero title="Career paths are unavailable" subtitle="Please try again in a moment." />
    </MarketingPage>
  ),
  component: CareersIndex,
});

function CareersIndex() {
  const { data: careers } = useSuspenseQuery(careersQuery);

  return (
    <MarketingPage>
      <PageHero
        eyebrow="Career paths"
        title="Pick the role you are aiming for"
        subtitle="Each path carries a curated skill profile with importance levels and required proficiency, so your gap analysis means something."
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {careers.map((career, i) => {
            const hasSalary = career.salaryMin !== null || career.salaryMax !== null;
            const salaryLabel = hasSalary
              ? formatSalaryRange(career.salaryMin, career.salaryMax, career.currency)
              : null;
            return (
              <Reveal key={career.id} delay={Math.min(i * 60, 300)}>
                <Link
                  to="/careers/$slug"
                  params={{ slug: career.slug }}
                  className="panel hover-lift group flex h-full flex-col p-6"
                >
                  <h2 className="text-lg font-semibold">{career.title}</h2>
                  <p className="text-muted-foreground mt-2 flex-1 text-sm">
                    {career.shortDescription}
                  </p>
                  <dl className="text-muted-foreground mt-5 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5" />
                      <span>{career.skillCount} skills in the profile</span>
                    </div>
                    {salaryLabel && (
                      <div>
                        Typical range{" "}
                        <span className="text-foreground font-medium">{salaryLabel}</span>
                      </div>
                    )}
                  </dl>
                  <span className="text-primary mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
                    View skill profile
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-8 text-sm">
          Aiming for something else? You can enter a custom role during onboarding.
        </p>
      </section>
    </MarketingPage>
  );
}
