import { Link } from "@tanstack/react-router";
import { Briefcase, Compass, LayoutDashboard, Library, Mail, Users } from "lucide-react";

const ADMIN_NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/jobs", label: "Jobs / Ingestion", icon: Briefcase },
  { to: "/admin/careers", label: "Careers", icon: Compass },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/catalog", label: "Catalog", icon: Library },
  { to: "/admin/contact", label: "Contact", icon: Mail },
] as const;

export function AdminSubNav() {
  return (
    <nav
      aria-label="Admin sections"
      className="mb-8 flex flex-wrap gap-2 border-b border-border/70 pb-4"
    >
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-full border border-border/70 px-3.5 py-1.5 text-sm font-medium transition-colors"
          activeOptions={{ exact: item.to === "/admin" }}
          activeProps={{ className: "bg-primary-soft text-primary border-transparent" }}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
