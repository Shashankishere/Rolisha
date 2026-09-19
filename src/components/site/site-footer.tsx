import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";

const GROUPS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/how-it-works", label: "How it works" },
      { to: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Careers",
    links: [
      { to: "/careers", label: "All career paths" },
      { to: "/careers/data-analyst", label: "Data Analyst" },
      { to: "/careers/frontend-developer", label: "Frontend Developer" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border/70 bg-surface border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm">
            Stop guessing what to learn. Learn what real jobs require.
          </p>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="text-foreground text-sm font-semibold">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-border/70 border-t">
        <p className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-6 text-xs sm:px-6">
          © {new Date().getFullYear()} Rolisha. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
