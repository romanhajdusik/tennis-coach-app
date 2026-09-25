import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Právne dokumenty (podmienky, zásady) žijú v `docs/*.md` — tam sa schvaľujú
 * a odtiaľ sa generuje Word aj čitateľská stránka. Verejná stránka appky ich
 * číta z TOHO ISTÉHO súboru, aby znenie nežilo na dvoch miestach a nerozišlo
 * sa. Text sa teda NEKOPÍRUJE do `messages/` — na rozdiel od marketingových
 * textov, ktoré sa menia inak a prekladajú sa.
 *
 * Číta sa pri builde (stránky sú statické), takže na produkcii sa žiadny
 * súbor za behu neotvára.
 */

/** Zobrazuje sa ZÁVÄZNÉ anglické znenie; slovenské je v tom istom súbore preklad. */
const EN_MARK = "# ENGLISH";
const SK_MARK = "# SLOVENSKY";
const NOTES_MARK = "## Poznámky k návrhu";

export type Run =
  | { kind: "text"; text: string; bold?: boolean; italic?: boolean }
  /** Nevyplnené miesto v hranatých zátvorkách — pred zverejnením sa musí doplniť. */
  | { kind: "blank"; text: string };

export type Block =
  | { kind: "heading"; number: string | null; text: string; id: string }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Run[][] }
  /**
   * Citovaný blok (`>`). V podmienkach ani zásadách sa nevyskytuje — je to
   * voliteľný odsek o zdraví v texte pre rodičov, ktorý tréner použije len
   * vtedy, keď zranenia naozaj zapisuje.
   */
  | { kind: "quote"; blocks: Block[] };

export type LegalDoc = {
  /** Nadpis dokumentu z jeho anglického znenia (`## …`). */
  title: string;
  blocks: Block[];
  /** Koľko nevyplnených miest v texte ostalo — stránka sa podľa toho vie zachovať. */
  blanks: number;
};

/**
 * Prázdne zátvorky nie sú diera, ale zaškrtávacie políčko (`[ ] yes [ ] no`
 * v súhlase so zdravotnými údajmi). Keby sa brali ako nevyplnené miesto,
 * stránka by žltou hlásila chybu tam, kde má byť štvorček na papieri.
 */
function isCheckbox(inner: string) {
  return /^\s*$/.test(inner);
}

function inlineRuns(raw: string): Run[] {
  // Odkaz `[text](cieľ)` sa zobrazí ako text — cieľom je iný dokument, nie web.
  const s = raw
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  const runs: Run[] = [];
  // `**tučné**` sa skúša pred `*kurzívou*`, inak by sa dvojhviezdička rozpadla.
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;

  // Zátvorky sa hľadajú aj VNÚTRI zvýrazneného textu — nevyplnené miesta sú
  // v dokumentoch bežne zvýraznené (`**[dátum]**`) a musia ostať vidieť.
  const pushMarked = (text: string, mark: { bold?: boolean; italic?: boolean }) => {
    const inner = /\[([^\]]*)\]/g;
    let from = 0;
    let b: RegExpExecArray | null;
    while ((b = inner.exec(text)) !== null) {
      if (b.index > from) {
        runs.push({ kind: "text", text: text.slice(from, b.index), ...mark });
      }
      if (isCheckbox(b[1])) runs.push({ kind: "text", text: b[0], ...mark });
      else runs.push({ kind: "blank", text: b[1] });
      from = b.index + b[0].length;
    }
    if (from < text.length) runs.push({ kind: "text", text: text.slice(from), ...mark });
  };

  while ((m = re.exec(s)) !== null) {
    if (m.index > last) runs.push({ kind: "text", text: s.slice(last, m.index) });
    if (m[1] !== undefined) pushMarked(m[1], { bold: true });
    else if (m[2] !== undefined) pushMarked(m[2], { italic: true });
    else if (isCheckbox(m[3])) runs.push({ kind: "text", text: m[0] });
    else runs.push({ kind: "blank", text: m[3] });
    last = m.index + m[0].length;
  }
  if (last < s.length) runs.push({ kind: "text", text: s.slice(last) });
  return runs;
}

/** Kotva sa odvodzuje z čísla paragrafu, takže sa s textom nerozíde. */
function anchorFor(text: string, seq: number) {
  const n = text.match(/^(\d+)\./);
  return n ? `s${n[1]}` : `h${seq}`;
}

function countBlanks(blocks: Block[]): number {
  return blocks.reduce((sum, b) => {
    if (b.kind === "quote") return sum + countBlanks(b.blocks);
    const runs = b.kind === "paragraph" ? b.runs : b.kind === "list" ? b.items.flat() : [];
    return sum + runs.filter((r) => r.kind === "blank").length;
  }, 0);
}

/**
 * Riadky jedného dokumentu (alebo citovaného bloku) na bloky.
 *
 * `takeTitle` je tam kvôli citovaným blokom: vnútri nich je prvý nečíslovaný
 * nadpis skutočný nadpis odseku, nie názov dokumentu.
 */
function parseBody(body: string[], takeTitle = true): LegalDoc {
  const blocks: Block[] = [];
  let title = "";
  let para: string[] = [];
  let list: { ordered: boolean; items: string[][] } | null = null;
  let quote: string[] | null = null;
  let seq = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ kind: "paragraph", runs: inlineRuns(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((it) => inlineRuns(it.join(" "))),
    });
    list = null;
  };
  const flushQuote = () => {
    if (!quote) return;
    blocks.push({ kind: "quote", blocks: parseBody(quote, false).blocks });
    quote = null;
  };

  for (const line of body) {
    // Citovaný blok sa zbiera vcelku a rozparsuje až na konci — inak by sa
    // jeho odseky pomiešali s okolitým textom.
    const quoted = line.match(/^>\s?(.*)$/);
    if (quoted) {
      flushList();
      flushPara();
      quote = quote ?? [];
      quote.push(quoted[1]);
      continue;
    }
    flushQuote();

    if (/^\s*$/.test(line) || /^---+$/.test(line)) {
      flushList();
      flushPara();
      continue;
    }

    const heading = line.match(/^#{2,4}\s+(.*)$/);
    if (heading) {
      flushList();
      flushPara();
      const text = heading[1].trim();
      const num = text.match(/^(\d+)\.\s+(.*)$/);
      // Prvý nečíslovaný nadpis je názov dokumentu, nie sekcia.
      if (!num && !title && takeTitle) {
        title = text;
        continue;
      }
      blocks.push({
        kind: "heading",
        number: num ? num[1] : null,
        text: num ? num[2] : text,
        id: anchorFor(text, seq++),
      });
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push([(bullet ? bullet[1] : numbered![1]).trim()]);
      continue;
    }

    // Odsadené pokračovanie patrí k poslednej odrážke, inak k odseku.
    if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1].push(line.trim());
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushList();
  flushPara();
  flushQuote();

  return { title, blocks, blanks: countBlanks(blocks) };
}

export async function loadLegalDoc(file: string): Promise<LegalDoc> {
  const raw = await readFile(path.join(process.cwd(), "docs", file), "utf8");
  const lines = raw.split("\n");

  const iEn = lines.findIndex((l) => l.startsWith(EN_MARK));
  const iSk = lines.findIndex((l) => l.startsWith(SK_MARK));
  const iNotes = lines.findIndex((l) => l.startsWith(NOTES_MARK));
  if (iEn < 0 || iSk < 0) throw new Error(`${file}: chýba hranica znenia`);
  // Rovnaká poistka ako v generátoroch: radšej spadnúť než zverejniť interné poznámky.
  if (iNotes < 0) throw new Error(`${file}: nenašla sa časť „Poznámky k návrhu"`);

  return parseBody(lines.slice(iEn + 1, Math.min(iSk, iNotes)));
}

/**
 * Text, ktorý tréner odovzdáva rodičovi (`docs/gdpr-text-pre-rodicov.md`).
 *
 * Je stavaný inak než podmienky a zásady, preto vlastný loader: nemá hranice
 * `# ENGLISH` / `# SLOVENSKY`, ale číslované časti, z ktorých sa zverejňuje
 * **iba anglická** (rozhodol používateľ 2026-09-25 — appka aj celý verejný web
 * sú anglické, takže slovenská verzia by tu nemala komu slúžiť; v `docs/`
 * ostáva). Prvá časť je návod pre trénera a posledná interné poznámky — ani
 * jedna na stránku nepatrí.
 */
const PARENT_EN_MARK = "## 3. Anglická verzia";
const PARENT_NOTES_MARK = "## 4.";

export async function loadParentNotice(): Promise<LegalDoc> {
  const file = "gdpr-text-pre-rodicov.md";
  const raw = await readFile(path.join(process.cwd(), "docs", file), "utf8");
  const lines = raw.split("\n");

  const iEn = lines.findIndex((l) => l.startsWith(PARENT_EN_MARK));
  if (iEn < 0) throw new Error(`${file}: nenašla sa anglická verzia`);
  // Tá istá poistka ako pri ostatných: radšej spadnúť než zverejniť poznámky.
  const iNotes = lines.findIndex(
    (l, index) => index > iEn && l.startsWith(PARENT_NOTES_MARK),
  );
  if (iNotes < 0) throw new Error(`${file}: nenašla sa časť s poznámkami`);

  return parseBody(lines.slice(iEn + 1, iNotes));
}
