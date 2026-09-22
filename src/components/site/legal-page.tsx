import type { ReactNode } from "react";

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t py-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-3 space-y-3 text-sm text-pretty">{children}</div>
    </section>
  );
}

export function LegalTableOfContents({ sections }: { sections: { id: string; title: string }[] }) {
  return (
    <nav aria-label="Table of contents" className="panel mb-10 p-5">
      <p className="text-xs font-semibold tracking-wide uppercase">On this page</p>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-primary text-sm hover:underline">
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
