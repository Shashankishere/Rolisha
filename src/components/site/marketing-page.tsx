import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="dark bg-background text-foreground flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <section className="bg-halo bg-dot-grid border-border/70 border-b">
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
        {eyebrow && (
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-3 text-4xl font-semibold text-balance sm:text-5xl">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
