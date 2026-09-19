import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { Button } from "@/components/ui/button";

const TITLE = "How Rolisha works — from job requirements to your roadmap";
const DESCRIPTION =
  "See how Rolisha ingests job requirements, normalises skills, scores your gap and generates a six month learning plan you can actually follow.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: HowItWorksPage,
});

const PIPELINE = [
  {
    step: "01",
    title: "Job requirements are ingested",
    body: "Source adapters pull postings from legitimate job APIs and feeds into a normalised store: title, company, location, remote status, salary when published, requirements, experience and education, plus the source URL and retrieval date.",
  },
  {
    step: "02",
    title: "Skills are normalised",
    body: '"Microsoft Power BI" and "Power BI" become one canonical skill. Aliases are stored on the skill record, so demand percentages are computed on a clean vocabulary instead of raw strings.',
  },
  {
    step: "03",
    title: "Your profile is captured",
    body: "Onboarding collects your target role, education, current skills with confidence levels, experience, weekly hours, salary target and location preference.",
  },
  {
    step: "04",
    title: "The gap is scored",
    body: "Each requirement is weighted by importance, then compared to your level. Coverage across the profile becomes your readiness score — and every input stays visible in the matrix.",
  },
  {
    step: "05",
    title: "A roadmap is generated",
    body: "The roadmap engine sequences your gaps into six months of goals, topics, projects and milestones, then splits each month into weekly tasks sized to your available hours.",
  },
  {
    step: "06",
    title: "Progress feeds back in",
    body: "Completing tasks, projects and assessments updates your skill levels. Readiness recalculates and the plan reprioritises what matters next.",
  },
];

function HowItWorksPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="How it works"
        title="Your career roadmap, built from real job requirements"
        subtitle="Six stages, one principle: the requirements decide what you learn — not generic career advice."
      />

      <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <ol className="space-y-4">
          {PIPELINE.map((item) => (
            <li key={item.step} className="panel flex gap-5 p-6">
              <span className="text-gradient font-display text-2xl font-semibold">{item.step}</span>
              <div>
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="panel mt-10 p-6">
          <h2 className="text-lg font-semibold">How the readiness score is calculated</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Each required skill carries a weight by importance (critical 2.2, high 1.6, medium 1.0,
            nice to have 0.5). Your coverage of a skill is your level divided by the required level,
            capped at 100%. Readiness is the weighted average of that coverage across the role's
            whole skill profile.
          </p>
          <p className="text-muted-foreground mt-3 text-sm">
            Job match uses a separate, configurable weighting: skills 55%, experience 15%, education
            10%, location 10%, salary alignment 10%. Each component is shown next to the total.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              Start my roadmap
            </Link>
          </Button>
        </div>
      </section>
    </MarketingPage>
  );
}
