import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Briefcase, ClipboardCheck, Compass, FolderGit2, Library, Users } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { AdminAccessFallback } from "@/components/admin/admin-access-fallback";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";
import { Reveal } from "@/components/app/reveal";
import { AnimatedNumber } from "@/components/app/animated-number";
import { getAdminOverview } from "@/lib/admin.functions";

function overviewQuery() {
  return queryOptions({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
  });
}

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery()),
  head: () => ({
    meta: [{ title: "Admin — Rolisha" }, { name: "robots", content: "noindex" }],
  }),
  errorComponent: ({ error, reset }) => (
    <AdminAccessFallback error={error} reset={reset} routeId="admin.index" title="Admin" />
  ),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { data } = useSuspenseQuery(overviewQuery());

  const cards = [
    {
      label: "Jobs",
      icon: Briefcase,
      value: data.jobs.total,
      sub: `${data.jobs.live} live · ${data.jobs.demo} seeded`,
      to: "/admin/jobs",
    },
    {
      label: "Careers",
      icon: Compass,
      value: data.careers,
      sub: "in catalog",
      to: "/admin/careers",
    },
    {
      label: "Assessments",
      icon: ClipboardCheck,
      value: data.assessments,
      sub: "quizzes",
      to: "/admin/catalog",
    },
    {
      label: "Projects",
      icon: FolderGit2,
      value: data.projects,
      sub: "learning projects",
      to: "/admin/catalog",
    },
    {
      label: "Resources",
      icon: Library,
      value: data.resources,
      sub: "learning links",
      to: "/admin/catalog",
    },
    {
      label: "Users",
      icon: Users,
      value: data.users,
      sub: `${data.admins} admin${data.admins === 1 ? "" : "s"}`,
      to: "/admin/users",
    },
  ];

  return (
    <AppShell
      title="Admin"
      description="Internal tools for managing Rolisha's data. Restricted to admin accounts, enforced server side."
    >
      <AdminSubNav />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <Reveal key={card.label} delay={i * 60}>
            <Link to={card.to} className="panel hover-lift block p-6">
              <div className="bg-primary-soft text-primary inline-flex size-10 items-center justify-center rounded-xl">
                <card.icon className="size-5" />
              </div>
              <p className="font-display mt-4 text-3xl font-semibold tabular-nums">
                <AnimatedNumber value={card.value} />
              </p>
              <p className="mt-1 text-sm font-medium">{card.label}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{card.sub}</p>
            </Link>
          </Reveal>
        ))}
      </div>

      {data.jobs.total === 0 && (
        <div className="panel hover-lift mt-6 p-6">
          <p className="text-sm font-medium">No jobs have been ingested yet.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Run a search from{" "}
            <Link to="/admin/jobs" className="text-primary underline underline-offset-2">
              Jobs / Ingestion
            </Link>{" "}
            to pull live postings from Adzuna.
          </p>
        </div>
      )}
    </AppShell>
  );
}
