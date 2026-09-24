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
  | { kind: "text"; text: string; bold?: boolean }
  /** Nevyplnené miesto v hranatých zátvorkách — pred zverejnením sa musí doplniť. */
  | { kind: "blank"; text: string };

export type Block =
  | { kind: "heading"; number: string | null; text: string; id: string }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; items: Run[][] };

export type LegalDoc = {
  /** Nadpis dokumentu z jeho anglického znenia (`## …`). */
  title: string;
  blocks: Block[];
  /** Koľko nevyplnených miest v texte ostalo — stránka sa podľa toho vie zachovať. */
  blanks: number;
};

function inlineRuns(raw: string): Run[] {
  // Odkaz `[text](cieľ)` sa zobrazí ako text — cieľom je iný dokument, nie web.
  const s = raw
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  const runs: Run[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;

  // Zátvorky sa hľadajú aj VNÚTRI tučného textu — nevyplnené miesta sú
  // v dokumentoch bežne zvýraznené (`**[dátum]**`) a musia ostať vidieť.
  const pushBlanks = (text: string, bold: boolean) => {
    const inner = /\[([^\]]+)\]/g;
    let from = 0;
    let b: RegExpExecArray | null;
    while ((b = inner.exec(text)) !== null) {
      if (b.index > from) runs.push({ kind: "text", text: text.slice(from, b.index), bold });
      runs.push({ kind: "blank", text: b[1] });
      from = b.index + b[0].length;
    }
    if (from < text.length) runs.push({ kind: "text", text: text.slice(from), bold });
  };

  while ((m = re.exec(s)) !== null) {
    if (m.index > last) runs.push({ kind: "text", text: s.slice(last, m.index) });
    if (m[1] !== undefined) pushBlanks(m[1], true);
    else runs.push({ kind: "blank", text: m[2] });
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

export async function loadLegalDoc(file: string): Promise<LegalDoc> {
  const raw = await readFile(path.join(process.cwd(), "docs", file), "utf8");
  const lines = raw.split("\n");

  const iEn = lines.findIndex((l) => l.startsWith(EN_MARK));
  const iSk = lines.findIndex((l) => l.startsWith(SK_MARK));
  const iNotes = lines.findIndex((l) => l.startsWith(NOTES_MARK));
  if (iEn < 0 || iSk < 0) throw new Error(`${file}: chýba hranica znenia`);
  // Rovnaká poistka ako v generátoroch: radšej spadnúť než zverejniť interné poznámky.
  if (iNotes < 0) throw new Error(`${file}: nenašla sa časť „Poznámky k návrhu"`);

  const body = lines.slice(iEn + 1, Math.min(iSk, iNotes));

  const blocks: Block[] = [];
  let title = "";
  let para: string[] = [];
  let list: { ordered: boolean; items: string[][] } | null = null;
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

  for (const line of body) {
    if (/^\s*$/.test(line) || /^---+$/.test(line)) {
      flushList();
      flushPara();
      continue;
    }

    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      flushList();
      flushPara();
      const text = heading[1].trim();
      const num = text.match(/^(\d+)\.\s+(.*)$/);
      // Prvý nečíslovaný nadpis je názov dokumentu, nie sekcia.
      if (!num && !title) {
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

  const blanks = blocks.reduce((sum, b) => {
    const runs = b.kind === "paragraph" ? b.runs : b.kind === "list" ? b.items.flat() : [];
    return sum + runs.filter((r) => r.kind === "blank").length;
  }, 0);

  return { title, blocks, blanks };
}
