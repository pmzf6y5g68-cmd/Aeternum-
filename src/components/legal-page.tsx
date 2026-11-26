import { Logo } from "./logo";
import { SiteFooter } from "./site-footer";
import { siteConfig } from "@/config/site";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">Dernière mise à jour : {siteConfig.legal.lastUpdated}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mt-2 leading-relaxed text-ink">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
