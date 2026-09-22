import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  ClipboardCheck,
  FolderGit2,
  LayoutDashboard,
  LineChart,
  LogOut,
  Map as MapIcon,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getIsAdmin } from "@/lib/me.functions";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/roadmap", label: "Roadmap", icon: MapIcon },
  { to: "/skills", label: "Skill gap", icon: Target },
  { to: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { to: "/projects", label: "Projects", icon: FolderGit2 },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/premium", label: "AI Tools", icon: Sparkles },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  title,
  description,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  description?: string;
  /** Optional trail shown above the title, e.g. [{ label: "Projects", to: "/projects" }].
   * The current page's title is always the implicit final crumb, so don't
   * include it here. */
  breadcrumb?: { label: string; to?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => getIsAdmin(),
    staleTime: 5 * 60 * 1000,
  });

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  // `app-premium` is also applied to the wrapper div below for this
  // subtree's own styling, but Radix portals (Select/DropdownMenu/
  // Popover/Tooltip/Dialog content) mount under <body>, outside that
  // div. Mirroring the class onto <body> while the authenticated shell
  // is mounted lets that portaled content pick up the same
  // `.dark.app-premium` token overrides instead of falling back to the
  // plain `.dark` marketing theme. `dark` itself is already set on
  // <html> for every route, so there's no unstyled flash — this only
  // adds the app-premium-specific overrides for authenticated pages.
  useEffect(() => {
    document.body.classList.add("app-premium");
    return () => document.body.classList.remove("app-premium");
  }, []);

  return (
    <div className="dark app-premium bg-surface flex min-h-screen">
      <aside className="border-border/70 bg-background hidden w-64 shrink-0 flex-col border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        <div className="border-border/70 flex h-16 items-center border-b px-5">
          <Logo />
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} isAdmin={Boolean(isAdmin)} />
        <div className="border-border/70 border-t p-4">
          <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border/70 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-lg lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Logo />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="hover:bg-muted rounded-lg p-2"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
          {open && (
            <div className="border-border/70 border-t pb-3">
              <SidebarNav onNavigate={() => setOpen(false)} isAdmin={Boolean(isAdmin)} />
              <div className="px-3">
                <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            </div>
          )}
        </header>

        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
            {breadcrumb && breadcrumb.length > 0 && (
              <nav
                aria-label="Breadcrumb"
                className="text-muted-foreground mb-3 flex flex-wrap items-center gap-1.5 text-sm"
              >
                {breadcrumb.map((crumb) => (
                  <span key={crumb.label} className="flex items-center gap-1.5">
                    {crumb.to ? (
                      <Link to={crumb.to} className="hover:text-foreground transition-colors">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                    <span aria-hidden="true">/</span>
                  </span>
                ))}
                <span className="text-foreground font-medium">{title}</span>
              </nav>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
                {description && (
                  <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{description}</p>
                )}
              </div>
              {actions}
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate, isAdmin }: { onNavigate: () => void; isAdmin: boolean }) {
  return (
    <nav aria-label="Application" className="flex-1 space-y-1 p-3">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary-soft text-primary hover:bg-primary-soft" }}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <>
          <div className="border-border/70 my-2 border-t" />
          <Link
            to="/admin"
            onClick={onNavigate}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            activeProps={{ className: "bg-primary-soft text-primary hover:bg-primary-soft" }}
          >
            <ShieldCheck className="size-4" />
            Admin
          </Link>
        </>
      )}
    </nav>
  );
}
