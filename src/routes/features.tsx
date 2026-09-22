import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarRange,
  ClipboardCheck,
  Database,
  FolderGit2,
  LineChart,
  Search,
  ShieldCheck,
} from "lucide-react";
import { MarketingPage, PageHero } from "@/components/site/marketing-page";
import { Button } from "@/components/ui/button";

const TITLE = "Features — Rolisha career intelligence";
const DESCRIPTION =
  "Skill gap matrices, a six month roadmap engine, job matching with a transparent score, assessments, projects and an application tracker.";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: FeaturesPage,
});

const HERO_FEATURE = {
  icon: CalendarRange,
  title: "Six month roadmap engine",
  body: "Your skill gap, prioritised and packed into a six month plan: month goals, topics, estimated hours, a project and a milestone, then broken down into weekly tasks sized to the hours you actually have.",
  points: ["Month by month goals", "Weekly, hour sized tasks", "A project per milestone"],
};

interface FeatureItem {
  icon: typeof BarChart3;
  title: string;
  body: string;
}

interface FeatureGroup {
  label: string;
  description: string;
  items: FeatureItem[];
}

const GROUPS: FeatureGroup[] = [
  {
    label: "Understand where you stand",
    description: "The analysis your roadmap and matches are built on.",
    items: [
      {
        icon: BarChart3,
        title: "Skill gap analysis",
        body: "A complete matrix: skill, importance, your level, the required level, the percentage gap and a status. Backed by radar, donut and progress visualisations.",
      },
      {
        icon: Database,
        title: "Job market intelligence",
        body: "Jobs analysed, most requested skills, salary range, remote availability and top locations — computed from stored postings and labelled by data mode.",
      },
    ],
  },
  {
    label: "Practise with real feedback",
    description: "Turn study time into evidence you can point to.",
    items: [
      {
        icon: ClipboardCheck,
        title: "Skill assessments",
        body: "Short multiple choice checks scoped to your target role that update your skill confidence and immediately recalculate your readiness score.",
      },
      {
        icon: FolderGit2,
        title: "Portfolio project generator",
        body: "Projects targeted at your gaps, with requirements, dataset suggestions, a README outline and a resume bullet.",
      },
      {
        icon: LineChart,
        title: "Progress timeline",
        body: "Every completed task, assessment and project is recorded so you can see readiness move over time.",
      },
    ],
  },
  {
    label: "Find and land the role",
    description: "Apply with a clear, explainable case for each match.",
    items: [
      {
        icon: BriefcaseBusiness,
        title: "Job matching with reasons",
        body: "A weighted score across skills, experience, education, location and salary — every component shown, weights configurable.",
      },
      {
        icon: Search,
        title: "Global search",
        body: "Search careers, skills, jobs, projects and resources from one place, with filters per entity type.",
      },
      {
        icon: Bell,
        title: "Notifications",
        body: "In app alerts for milestones, weekly goals, assessment results and application follow ups. Email delivery can be layered on later.",
      },
    ],
  },
];

function FeaturesPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Features"
        title="Everything you need to go from unsure to job ready"
        subtitle="Rolisha is a career intelligence workspace: analyse, plan, practise, apply and track — with the reasoning always visible."
      >
        <Button asChild size="lg">
          <Link to="/auth" search={{ mode: "signup" }}>
            Build My Career Roadmap
          </Link>
        </Button>
      </PageHero>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        {/* Hero feature: the product's core loop gets a stronger, distinct treatment */}
        <article className="panel border-primary/20 grid gap-8 overflow-hidden p-8 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              <HERO_FEATURE.icon className="size-3.5" />
              Core engine
            </span>
            <h2 className="font-display mt-4 text-2xl font-semibold sm:text-3xl">
              {HERO_FEATURE.title}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl text-base text-pretty">
              {HERO_FEATURE.body}
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {HERO_FEATURE.points.map((point) => (
              <li
                key={point}
                className="bg-surface-strong border-border flex h-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium text-foreground"
              >
                <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                {point}
              </li>
            ))}
          </ul>
        </article>

        {/* Grouped, varied-size feature sections */}
        <div className="mt-14 space-y-14">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="max-w-2xl">
                <h3 className="font-display text-xl font-semibold">{group.label}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">{group.description}</p>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <article
                    key={item.title}
                    className="panel group flex h-full flex-col p-6 transition-shadow hover:shadow-lift"
                  >
                    <div className="bg-primary-soft text-primary inline-flex size-10 items-center justify-center rounded-xl">
                      <item.icon className="size-5" />
                    </div>
                    <h4 className="mt-4 text-base font-semibold">{item.title}</h4>
                    <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Trust: full-width closing feature, distinct from the grid above */}
        <article className="panel mt-14 flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:gap-6">
          <div className="bg-primary-soft text-primary inline-flex size-12 shrink-0 items-center justify-center rounded-xl">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Private by design</h3>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Row level security means your profile, progress and applications are only readable by
              you. Admin capabilities live behind a separate role.
            </p>
          </div>
        </article>
      </section>
    </MarketingPage>
  );
}
