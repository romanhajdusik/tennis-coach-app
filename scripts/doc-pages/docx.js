// POZOR: OD 2026-09-25 SA TENTO GENERÁTOR NEPOUŽÍVA (rozhodol používateľ:
// „všetky dokumenty rob len v Google Docs"). Dokumenty idú von ako Google Docs
// — zdroj `docs/*.md` → `split.js` → nahratie na Drive ako `text/markdown`,
// Drive z toho spraví Google Doc aj s nadpismi a tabuľkami. Nahrať hotový
// .docx cez MCP NEJDE, base64 sa pri prenose poškodí.
// Skript ostáva v repe pre prípad, že by si ho používateľ vypýtal; nespúšťaj
// ho sám od seba.
//
// Postaví z dvojjazyčného dokumentu v `docs/` jeden .docx na posielanie —
// obe znenia za sebou (najprv záväzná angličtina, potom slovenský preklad),
// aby kontrolór mohol písať pripomienky rovno do textu cez sledovanie zmien.
//
//   node scripts/doc-pages/docx.js podmienky-trener   # jeden, podľa kľúča v pages.json
//   node scripts/doc-pages/docx.js                    # všetky
//
// **Interná časť „Poznámky k návrhu" sa do výstupu NIKDY nedostane** — rovnaká
// poistka ako v `build.js`: keď sa ten nadpis nenájde, skript skončí chybou
// namiesto toho, aby ticho poslal von naše úvahy o obchodných rozhodnutiach.
//
// Knižnica `docx` nie je závislosťou projektu (ako playwright) — pred spustením
// `npm install --no-save docx`, po dokončení `npm uninstall docx`.
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, PageBreak, Footer, PageNumber,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle,
} = require('docx');
const split = require('./split');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, 'build');

const pages = JSON.parse(fs.readFileSync(path.join(HERE, 'pages.json'), 'utf8'));

// Nevyplnené hranaté zátvorky sa zvýrazňujú žltou. Je to informácia pre
// kontrolóra, nie ozdoba: má vidieť, čo je otvorené miesto a čo znenie.
const HIGHLIGHT = 'yellow';

// ——— inline: **tučné**, [nevyplnené], odkazy na iné dokumenty ———

// Odkaz `[text](cieľ)` sa zmení na samotný text. Keď je cieľ zástupný
// (`link`/`odkaz`), pripíše sa za text zvýraznená poznámka — chýbajúca adresa
// zásad je jedna z vecí, ktoré sa dopĺňajú pred zverejnením.
function stripLinks(s, lang) {
  const missing = lang === 'en' ? ' [URL to be added]' : ' [adresu doplniť]';
  return s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) =>
    text + (/^(link|odkaz)$/i.test(href) ? missing : ''));
}

function bracketRuns(s, opts) {
  const runs = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: s.slice(last, m.index), ...opts }));
    runs.push(new TextRun({ text: m[0], ...opts, highlight: HIGHLIGHT }));
    last = m.index + m[0].length;
  }
  if (last < s.length) runs.push(new TextRun({ text: s.slice(last), ...opts }));
  return runs;
}

// Kurzíva sa hľadá až v texte bez tučného, inak by si `*` a `**` liezli do cesty.
function italicRuns(s, bold) {
  const out = [];
  const re = /\*([^*]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(...bracketRuns(s.slice(last, m.index), { bold }));
    out.push(...bracketRuns(m[1], { bold, italics: true }));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(...bracketRuns(s.slice(last), { bold }));
  return out;
}

function runs(raw, lang) {
  const s = stripLinks(raw, lang).replace(/`([^`]+)`/g, '$1');
  const out = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(...italicRuns(s.slice(last, m.index), false));
    out.push(...italicRuns(m[1], true));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(...italicRuns(s.slice(last), false));
  return out;
}

// ——— bloky ———

const isHeading = l => /^#{2,3}\s/.test(l);
const headingText = l => l.replace(/^#{2,3}\s+/, '').trim();
const numbered = t => /^\d+\.\s/.test(t);

// Prevedie riadky jedného znenia na odseky. Odsek môže byť zalomený cez viac
// riadkov, odrážka takisto (pokračovanie je odsadené).
function convert(lines, lang) {
  const out = [];
  let para = [];
  let list = null; // { kind: 'bullet' | 'number', buf: [] }
  let quote = null; // citovaný blok (`>`) — v texte pre rodičov je ním odsek o súhlase

  const flushPara = () => {
    if (!para.length) return;
    out.push(new Paragraph({ children: runs(para.join(' '), lang) }));
    para = [];
  };
  const flushQuote = () => {
    if (!quote) return;
    for (const buf of quote) {
      if (!buf.length) continue;
      out.push(new Paragraph({
        indent: { left: 454 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF', space: 10 } },
        children: runs(buf.join(' '), lang),
      }));
    }
    quote = null;
  };
  const flushItem = () => {
    if (!list || !list.buf.length) return;
    out.push(new Paragraph({
      numbering: { reference: list.kind === 'bullet' ? 'odrazky' : 'cisla-' + lang, level: 0 },
      children: runs(list.buf.join(' '), lang),
    }));
    list.buf = [];
  };
  const flushList = () => { flushItem(); list = null; };

  for (const line of lines) {
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushItem(); flushPara();
      if (!quote) quote = [[]];
      if (q[1].trim() === '') { if (quote[quote.length - 1].length) quote.push([]); }
      else quote[quote.length - 1].push(q[1].trim());
      continue;
    }

    if (/^\s*$/.test(line)) { flushItem(); flushPara(); continue; }
    if (/^---+$/.test(line)) { flushQuote(); flushList(); flushPara(); continue; }

    if (isHeading(line)) {
      flushQuote(); flushList(); flushPara();
      const text = headingText(line);
      out.push(new Paragraph({
        heading: numbered(text) ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        children: runs(text, lang),
      }));
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    const number = line.match(/^(\d+)\.\s+(.*)$/);
    if (bullet || number) {
      flushQuote(); flushItem(); flushPara();
      list = { kind: bullet ? 'bullet' : 'number', buf: [bullet ? bullet[1] : number[2]] };
      continue;
    }

    // Odsadené pokračovanie patrí k poslednej odrážke, inak k odseku.
    if (list && /^\s+\S/.test(line)) { list.buf.push(line.trim()); continue; }
    flushQuote(); flushList();
    para.push(line.trim());
  }
  flushQuote(); flushItem(); flushPara();
  return out;
}

// ——— hlavička pre kontrolóra ———

// Hlavičkové polia v `pages.json` sú písané pre HTML stránku, takže nesú entity
// a značky; do Wordu ide holý text.
const plain = s => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&middot;/g, '·')
  .replace(/&amp;/g, '&');

function intro(cfg, enTitle) {
  const line = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], ...(opts.paragraph || {}) });
  return [
    new Paragraph({
      children: [new TextRun({ text: plain(cfg.eyebrow), size: 18, color: '808080' })],
      spacing: { after: 120 },
    }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: enTitle, bold: true, size: 36 })] }),
    new Paragraph({
      children: [new TextRun({ text: plain(cfg.h1), size: 24, color: '595959' })],
      spacing: { after: 360 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D0D0D0', space: 8 } },
    }),
    line('For review', { bold: true, size: 24 }),
    new Paragraph({
      spacing: { before: 120 },
      children: runs(cfg.docxStatusEn, 'en'),
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Passages ' }),
        new TextRun({ text: 'highlighted like this', highlight: HIGHLIGHT }),
        ...runs(' are placeholders still to be filled in — the alternative dispute resolution body, the effective date and the link to the Privacy Policy. They are open items, not omissions in the wording.', 'en'),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: runs('Internal drafting notes from the source file are deliberately not included here.', 'en'),
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: runs('**Po slovensky:** ' + cfg.docxStatusSk + ' Žltou sú vyznačené miesta, ktoré sa ešte dopĺňajú. Interné poznámky k návrhu súčasťou dokumentu nie sú.', 'sk'),
    }),
  ];
}

// ——— stavba dokumentu ———

function build(key, cfg) {
  const lines = fs.readFileSync(path.join(ROOT, 'docs', cfg.doc), 'utf8').split('\n');
  const { enLines, skLines } = split(lines, cfg);

  const firstHeading = enLines.find(isHeading);
  const hasOwnTitle = firstHeading && !numbered(headingText(firstHeading));
  const enTitle = hasOwnTitle ? headingText(firstHeading) : cfg.pageTitle;

  // Názov dokumentu je už na titulke, v texte by sa opakoval.
  const enBody = enLines.slice();
  if (hasOwnTitle) enBody.splice(enBody.indexOf(firstHeading), 1);

  const children = [
    ...intro(cfg, enTitle),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'English (binding version)', bold: true })],
    }),
    ...convert(enBody, 'en'),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Slovensky (preklad)', bold: true })],
    }),
    ...convert(skLines, 'sk'),
  ];

  const doc = new Document({
    creator: '&Go, s.r.o.',
    title: enTitle,
    description: cfg.pageTitle,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { line: 276, after: 140 } },
        },
        heading1: {
          run: { font: 'Calibri', size: 32, bold: true, color: '000000' },
          paragraph: { spacing: { before: 360, after: 160 }, keepNext: true },
        },
        heading2: {
          run: { font: 'Calibri', size: 26, bold: true, color: '000000' },
          paragraph: { spacing: { before: 280, after: 120 }, keepNext: true },
        },
        title: {
          run: { font: 'Calibri', size: 36, bold: true, color: '000000' },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    numbering: {
      config: ['odrazky', 'cisla-en', 'cisla-sk'].map(reference => ({
        reference,
        levels: [{
          level: 0,
          format: reference === 'odrazky' ? LevelFormat.BULLET : LevelFormat.DECIMAL,
          text: reference === 'odrazky' ? '•' : '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { after: 100 } } },
        }],
      })),
    },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              children: [enTitle + '  ·  &Go, s.r.o.  ·  ', PageNumber.CURRENT],
              size: 16,
              color: '808080',
            })],
          })],
        }),
      },
      children,
    }],
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, key + '.docx');
  return Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(out, buf);
    return { out, size: buf.length };
  });
}

const only = process.argv[2];
const keys = only ? [only] : Object.keys(pages);
if (only && !pages[only]) throw new Error('neznámy dokument: ' + only + ' (mám ' + Object.keys(pages).join(', ') + ')');

(async () => {
  for (const key of keys) {
    const r = await build(key, pages[key]);
    console.log(key.padEnd(20) + r.out + '  (' + Math.round(r.size / 1024) + ' kB)');
  }
})();
