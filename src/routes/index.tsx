import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  Database,
  FolderGit2,
  LineChart,
  Radar,
  Sparkles,
  Target,
} from "lucide-react";
import { MarketingPage } from "@/components/site/marketing-page";
import { CareerEngine3D } from "@/components/marketing/career-engine-3d";
import { CareerJourneySection } from "@/components/marketing/career-journey-section";
import { SkillConstellationSection } from "@/components/marketing/skill-constellation-section";
import { MagneticButton } from "@/components/app/magnetic-button";
import { JobMatchPreview } from "@/components/marketing/job-match-preview";
import { ProjectWorkspacePreview } from "@/components/marketing/project-workspace-preview";
import { Reveal } from "@/components/app/reveal";
import { TiltCard } from "@/components/app/tilt-card";
import { AnimatedNumber } from "@/components/app/animated-number";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TITLE = "Rolisha — Stop guessing what to learn";
const DESCRIPTION =
  "Rolisha compares your skills with real job requirements and builds a personalised six month roadmap to help you become job ready.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    icon: Target,
    title: "Tell us your target role",
    body: "Pick from eight supported career paths or enter your own. We load the skill profile employers ask for.",
  },
  {
    icon: Radar,
    title: "We compare your skills",
    body: "Every requirement is scored against your self assessed level and any assessments you complete.",
  },
  {
    icon: CalendarRange,
    title: "You get a six month plan",
    body: "Month by month goals, weekly tasks sized to your hours, projects and vetted free resources.",
  },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: "Skill gap analysis",
    body: "A full matrix of importance, your level, required level and the exact percentage gap for each skill.",
  },
  {
    icon: CalendarRange,
    title: "Personalised roadmap",
    body: "Six months, broken into weekly tasks that fit the hours you actually have available.",
  },
  {
    icon: Database,
    title: "Real job intelligence",
    body: "Requirements come from job postings stored in the product, always labelled with their data mode.",
  },
  {
    icon: FolderGit2,
    title: "Project recommendations",
    body: "Portfolio projects mapped to your gaps, with requirements, README outline and a resume bullet.",
  },
  {
    icon: LineChart,
    title: "Progress tracking",
    body: "Your readiness score updates as you complete tasks and assessments — with a full timeline.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Internship readiness",
    body: "See which seniority bands you already qualify for and what stands between you and the next one.",
  },
];

const STATS = [
  { value: 8, suffix: "", label: "Supported career paths" },
  { value: 50, suffix: "+", label: "Skills tracked in the catalogue" },
  { value: 47, suffix: "", label: "Skills with real learning content" },
  { value: 6, suffix: " months", label: "Roadmap horizon per plan" },
];

const FAQ = [
  {
    q: "Where do the job requirements come from?",
    a: "From job postings stored in the product's database and the skill profiles mapped to each career path. Everything in the app is labelled with its data mode, so you always know whether you are looking at sample data or live job listings.",
  },
  {
    q: "Is the readiness score just a guess?",
    a: "No. It is an importance weighted coverage calculation across the required skill profile. The dashboard shows the exact inputs — importance, your level, required level and gap — for every skill.",
  },
  {
    q: "Do I need to pay to get a roadmap?",
    a: "The free plan includes one career roadmap, the skill gap analysis and a limited set of job matches. Paid plans add unlimited roadmaps, assessments and the application tracker.",
  },
  {
    q: "What if my target role is not listed?",
    a: "You can enter any custom role during onboarding. Supported paths come with a curated skill profile; custom roles use the AI roadmap engine with the closest matching profile.",
  },
  {
    q: "Does the roadmap change as I learn?",
    a: "Yes. Completing weekly tasks and assessments updates your skill levels, which recalculates readiness and reprioritises what to learn next.",
  },
];

function Landing() {
  return (
    <MarketingPage>
      {/* HERO */}
      <section className="bg-halo bg-dot-grid border-border/70 border-b">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="animate-rise">
            <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
              <Sparkles className="text-primary size-3.5" />
              AI powered career intelligence
            </span>
            <h1 className="mt-5 text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
              Turn your career goal into{" "}
              <span className="text-gradient">a path you can actually follow.</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">
              Rolisha compares your skills with real job requirements and builds a personalised
              roadmap to help you become job ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MagneticButton>
                <Button asChild size="lg">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Build My Roadmap
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </MagneticButton>
              <Button asChild size="lg" variant="outline">
                <Link to="/careers">Explore Careers</Link>
              </Button>
            </div>
            <ul className="text-muted-foreground mt-8 grid gap-2 text-sm sm:grid-cols-2">
              {[
                "Transparent readiness score",
                "Weekly plan sized to your hours",
                "Projects mapped to your gaps",
                "No fabricated market statistics",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="text-success size-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-rise lg:pl-6">
            <CareerEngine3D />
          </div>
        </div>
      </section>

      {/* ANIMATED STATS STRIP */}
      <section className="border-border/70 bg-surface border-b">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 90} className="text-center md:text-left">
              <p className="font-display text-3xl font-semibold sm:text-4xl">
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CareerJourneySection />

      <SkillConstellationSection />

      {/* HOW IT WORKS */}
      <Section
        eyebrow="How it works"
        title="Three steps from where you are to job ready"
        subtitle="Every output is traceable back to a requirement, not a hunch."
      >
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 100} as="li">
              <TiltCard maxTilt={4} className="h-full">
                <div className="panel hover-lift h-full p-6">
                  <div className="bg-primary-soft text-primary grid size-10 place-items-center rounded-xl">
                    <step.icon className="size-5" />
                  </div>
                  <p className="text-muted-foreground mt-4 text-xs font-semibold tracking-wide uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{step.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* FEATURES */}
      <Section
        eyebrow="What you get"
        title="A career intelligence workspace, not a chatbot"
        subtitle="Analysis, planning and tracking in one place — with the reasoning always visible."
        muted
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={Math.min(i * 70, 280)} as="article">
              <div className="panel hover-lift h-full p-6">
                <feature.icon className="text-primary size-5" />
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* JOB INTELLIGENCE */}
      <Section
        eyebrow="Real job intelligence"
        title="Requirements are the source of truth"
        subtitle="Rolisha ingests job postings through pluggable source adapters, normalises the messy skill names into a canonical catalogue, then scores you against what those postings actually ask for."
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-1">
            {[
              {
                title: "Normalised skills",
                body: '"Structured Query Language", "SQL Server" and "T-SQL" all resolve to one canonical SQL skill, so demand percentages mean something.',
              },
              {
                title: "Adapter architecture",
                body: "Legitimate job APIs and feeds plug in as sources. Nothing is scraped in ways that breach a site's terms.",
              },
              {
                title: "Honest labelling",
                body: "Every market panel is labelled by where its data comes from, and sample numbers are never presented as current statistics.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 90}>
                <div className="panel hover-lift h-full p-6">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <JobMatchPreview />
          </Reveal>
        </div>
      </Section>

      {/* PROJECT BUILDING */}
      <Section
        eyebrow="Build the proof"
        title="Turn learning into a portfolio, not just a certificate"
        subtitle="Every project has a real objective, a task list, the skills it exercises, and a place to publish the result — so finishing one means something to an employer."
        muted
      >
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1fr] lg:items-center">
          <Reveal className="min-w-0">
            <ProjectWorkspacePreview />
          </Reveal>
          <Reveal delay={100}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Clear objective",
                  body: "Every project states what you're building and why it matters for the role.",
                },
                {
                  title: "Step by step tasks",
                  body: "Broken into ordered, checkable steps — never a vague 'build something' prompt.",
                },
                {
                  title: "Mapped resources",
                  body: "Free, real learning resources linked to the exact skills each project uses.",
                },
                {
                  title: "Portfolio ready output",
                  body: "A resume ready summary once you finish, so the work travels beyond Rolisha.",
                },
              ].map((item) => (
                <li key={item.title} className="panel p-5">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-muted-foreground mt-1.5 text-sm">{item.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* FAQ */}
      <Section eyebrow="FAQ" title="Questions people ask first">
        <Reveal className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Section>

      {/* FINAL CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="bg-brand-gradient bg-dot-grid hover-lift relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center shadow-glow sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="animate-node-float absolute -top-24 -right-24 size-72 rounded-full bg-primary-foreground/10 blur-3xl"
            />
            <div
              aria-hidden
              className="animate-node-float absolute -bottom-20 -left-16 size-64 rounded-full bg-primary-foreground/10 blur-3xl"
              style={{ animationDelay: "2s" }}
            />
            <p className="text-primary-foreground/70 relative text-sm font-semibold tracking-widest uppercase">
              Stop guessing what to learn next
            </p>
            <h2 className="text-primary-foreground relative mt-3 text-3xl font-semibold text-balance sm:text-4xl lg:text-5xl">
              Build your career roadmap.
            </h2>
            <p className="text-primary-foreground/85 relative mx-auto mt-4 max-w-2xl text-pretty">
              Answer eight short questions and get your skill gap, readiness score and six month
              plan in a couple of minutes.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <MagneticButton>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Build My Career Roadmap
                  </Link>
                </Button>
              </MagneticButton>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/careers">Browse career paths</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </MarketingPage>
  );
}

function Section({
  eyebrow,
  title,
  subtitle,
  children,
  muted = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={muted ? "bg-surface border-border/70 border-y" : undefined}>
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold text-balance sm:text-4xl">{title}</h2>
          {subtitle && <p className="text-muted-foreground mt-4 text-pretty">{subtitle}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
