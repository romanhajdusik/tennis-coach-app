import type { ReactNode } from "react";
import Link from "next/link";
import type { Block, LegalDoc, Run } from "@/lib/legal-docs";
import { Wordmark } from "@/components/wordmark";

/**
 * Spoločné vykreslenie právneho dokumentu (podmienky, zásady). Text prichádza
 * zo schváleného súboru v `docs/` cez `loadLegalDoc()` — táto vrstva rieši len
 * podobu. Štýl je zámerne ten istý ako `/navod` a `/cennik-hrac`: tmavá téma
 * cez tokeny, mobile first.
 */

type Props = {
  doc: LegalDoc;
  /** Komu je dokument určený — drobný riadok pod nadpisom. */
  audience: string;
  /**
   * Odkaz na druhý dokument toho istého publika (podmienky ↔ zásady).
   * Text pre rodičov dvojicu nemá, preto je nepovinný.
   */
  sibling?: { href: string; label: string };
  /**
   * Vysvetlenie nad textom — dnes ho má len text pre rodičov, kde treba
   * povedať, že si ho tréner pred odovzdaním doplní o svoje meno a kontakt.
   */
  intro?: ReactNode;
};

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.kind === "blank" ? (
          // Nevyplnené miesto. Pred zverejnením tu nesmie ostať ani jedno —
          // preto je vidieť, nie schované.
          <mark
            key={i}
            className="rounded bg-amber-500/20 px-1 text-amber-200 ring-1 ring-inset ring-amber-500/40"
          >
            {run.text}
          </mark>
        ) : run.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {run.text}
          </strong>
        ) : run.italic ? (
          <em key={i} className="italic">
            {run.text}
          </em>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h2
              key={i}
              id={block.id}
              className="scroll-mt-20 pt-8 text-sm font-semibold tracking-tight text-foreground sm:text-base"
            >
              {block.number ? (
                <span className="mr-2 text-primary">{block.number}.</span>
              ) : null}
              {block.text}
            </h2>
          );
        }
        if (block.kind === "paragraph") {
          return (
            <p key={i} className="mt-3 text-xs leading-relaxed text-muted sm:text-[13px]">
              <Runs runs={block.runs} />
            </p>
          );
        }
        if (block.kind === "quote") {
          // Voliteľný odsek (dnes jediný: súhlas so zdravotnými údajmi v texte
          // pre rodičov). Rámček hovorí, že to nie je súčasť hlavného textu.
          return (
            <blockquote
              key={i}
              className="mt-4 rounded-xl border border-border bg-surface px-4 py-1 sm:px-5"
            >
              <Blocks blocks={block.blocks} />
            </blockquote>
          );
        }
        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={i}
            className={`mt-3 flex flex-col gap-2 pl-5 text-xs leading-relaxed text-muted sm:text-[13px] ${
              block.ordered ? "list-decimal" : "list-disc"
            } marker:text-primary`}
          >
            {block.items.map((item, j) => (
              <li key={j}>
                <Runs runs={item} />
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

export function LegalPage({ doc, audience, sibling, intro }: Props) {
  const sections = doc.blocks.filter((b) => b.kind === "heading" && b.number);

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="P.L.A.W">
            <Wordmark />
          </Link>
          {sibling ? (
            <Link
              href={sibling.href}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {sibling.label}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-4 px-4 pb-8 pt-12 text-center sm:px-6 sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {audience}
        </span>
        {/* Pod nadpisom NIE JE podhlavie s prevádzkovateľom ani s vetou
            o záväznom jazyku (odstránené 2026-09-25, rozhodol používateľ).
            Identifikácia firmy je v §1 každého dokumentu, takže čl. 13 je
            splnený aj bez nej; a veta o záväznej angličtine nemá adresáta —
            slovenské znenie sa nezverejňuje, web je jednojazyčný. */}
        <h1 className="text-xl font-bold tracking-tight text-balance text-foreground sm:text-2xl">
          {doc.title}
        </h1>
        {intro ? (
          <div className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-xs leading-relaxed text-muted sm:px-5">
            {intro}
          </div>
        ) : null}
      </section>

      {/* Obsah — na telefóne je dokument dlhý a bez neho sa v ňom nedá hýbať.
          Text pre rodičov číslované paragrafy nemá, tam by ostal prázdny. */}
      {sections.length > 0 ? (
      <nav
        aria-label="Contents"
        className="w-full max-w-3xl px-4 sm:px-6"
      >
        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contents</p>
          <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {sections.map((section) =>
              section.kind === "heading" ? (
                <li key={section.id} className="flex gap-2 text-xs">
                  <span className="w-5 shrink-0 text-right text-muted">{section.number}</span>
                  <a
                    href={`#${section.id}`}
                    className="text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                  >
                    {section.text}
                  </a>
                </li>
              ) : null,
            )}
          </ol>
        </div>
      </nav>
      ) : null}

      <article className="w-full max-w-3xl px-4 pb-4 sm:px-6">
        <Blocks blocks={doc.blocks} />
      </article>

      <footer className="w-full max-w-3xl px-4 py-10 text-center text-sm text-muted sm:px-6">
        <p>
          Questions?{" "}
          <a
            href="mailto:info@plawsports.com"
            className="font-medium text-foreground underline underline-offset-2"
          >
            info@plawsports.com
          </a>
        </p>
        {sibling ? (
          <p className="mt-2">
            <Link
              href={sibling.href}
              className="font-medium text-foreground underline underline-offset-2"
            >
              {sibling.label}
            </Link>
          </p>
        ) : null}
      </footer>
    </div>
  );
}
