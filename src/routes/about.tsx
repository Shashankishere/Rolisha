import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";

const TITLE = "About Rolisha";
const DESCRIPTION =
  "Rolisha exists because students are told to 'learn to code' instead of being shown exactly which skills real job postings require.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AboutPage,
});

const PRINCIPLES = [
  {
    title: "Requirements over opinions",
    body: "Job requirements are the source of truth for what to learn. Where we cannot back a claim with stored data, we say so.",
  },
  {
    title: "Explainable by default",
    body: "Every score can be opened up: which skills, which weights, which comparison. No black box percentage.",
  },
  {
    title: "Honest about data",
    body: "Sample data is labelled as sample data. We never present placeholder numbers as current market statistics.",
  },
  {
    title: "Useful offline of hype",
    body: "The product has to be useful even when no live job feed is connected, and private by default for everyone using it.",
  },
];

function AboutPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="About"
        title="Career guidance should be evidence, not encouragement"
        subtitle="Rolisha was built for students and early career professionals who are ready to work. They just need to know exactly what to work on."
      />

      <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="space-y-4 text-pretty">
          <p>
            Most career advice is generic: pick a field, take a course, build a project. Meanwhile
            the job market is extremely specific. A Data Analyst posting will name SQL, spreadsheet
            modelling and a BI tool. A frontend role will name accessibility and TypeScript. The gap
            between advice and requirement is where people lose months.
          </p>
          <p>
            Rolisha closes that gap by treating job requirements as the primary input. We normalise
            the messy vocabulary of postings into a canonical skill catalogue, compare it with what
            you already know, and turn the difference into a six month plan sized to the hours you
            actually have.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="panel p-6">
              <h2 className="text-base font-semibold">{p.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}
