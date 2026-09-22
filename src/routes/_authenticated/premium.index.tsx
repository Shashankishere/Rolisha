import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileSearch,
  FileText,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Repeat,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { Reveal } from "@/components/app/reveal";
import { LockedBadge } from "@/components/app/upgrade-prompt";
import { getSubscriptionStatus } from "@/lib/subscription.functions";
import { FEATURE_INFO, type Feature } from "@/lib/subscription";

const TOOLS: {
  to: string;
  feature: Feature;
  title: string;
  description: string;
  icon: typeof FileSearch;
}[] = [
  {
    to: "/premium/resume-analysis",
    feature: "resume_analysis",
    title: "AI resume analysis",
    description:
      "Score your resume against a target role: ATS readability, skill coverage, gaps, and fixes.",
    icon: FileSearch,
  },
  {
    to: "/premium/resume-optimization",
    feature: "resume_optimization",
    title: "Resume optimization",
    description:
      "See weak sections rewritten side by side: current versus recommended, before you change anything.",
    icon: FileText,
  },
  {
    to: "/premium/interview-prep",
    feature: "interview_preparation",
    title: "Interview preparation",
    description:
      "A structured study plan: likely technical and behavioral areas, and a pre interview checklist.",
    icon: ListChecks,
  },
  {
    to: "/premium/interview-questions",
    feature: "personalized_interview_questions",
    title: "Personalized interview questions",
    description: "Practice questions generated from your real skills, projects, and target role.",
    icon: MessagesSquare,
  },
  {
    to: "/premium/mock-interview",
    feature: "mock_interviews",
    title: "Mock interviews",
    description: "A full text based mock interview with question by question and overall feedback.",
    icon: MessageSquareText,
  },
  {
    to: "/premium/career-switch",
    feature: "career_switch_analysis",
    title: "Career switch analysis",
    description:
      "Compare your current background to a new target role: transferable skills, gaps, and a plan.",
    icon: Repeat,
  },
  {
    to: "/premium/career-recommendations",
    feature: "ai_career_recommendations",
    title: "AI career recommendations",
    description: "Roles that fit your real profile, with why they fit and what to do next.",
    icon: Sparkles,
  },
];

export const Route = createFileRoute("/_authenticated/premium/")({
  head: () => ({
    meta: [{ title: "AI Tools — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback
      error={error}
      reset={reset}
      routeId="premium"
      title="AI Tools unavailable"
      description="Please refresh to try again."
    />
  ),
  component: PremiumHub,
});

function PremiumHub() {
  const { data: subscription } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => getSubscriptionStatus(),
  });

  return (
    <AppShell
      title="AI Tools"
      description="AI powered tools for your resume, interviews, and next career move."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, i) => {
          const unlocked = subscription?.features[tool.feature] === true;
          const gate = FEATURE_INFO[tool.feature];
          return (
            <Reveal key={tool.to} delay={Math.min(i * 60, 300)} className="h-full">
              <Link to={tool.to} className="block h-full">
                <div className="panel hover-lift flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="bg-primary-soft text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                      <tool.icon className="size-5" />
                    </div>
                    {!unlocked && (
                      <LockedBadge
                        requiredPlan={gate.requiredPlan}
                        implemented={gate.implemented}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold">{tool.title}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">{tool.description}</p>
                  </div>
                  <div className="text-primary mt-auto flex items-center gap-1 text-sm font-medium">
                    {unlocked ? "Open" : "See what's included"}
                    <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </AppShell>
  );
}
