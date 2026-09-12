// Postaví z dvojjazyčného dokumentu v `docs/` jednu čitateľskú HTML stránku
// (obe znenia, prepínač, preklikateľný obsah). Výstup ide do `build/` a odtiaľ
// sa publikuje ako Artifact.
//
//   node scripts/doc-pages/build.js            # všetky štyri
//   node scripts/doc-pages/build.js zmluva     # len jeden, podľa kľúča v pages.json
//
// **Interná časť „Poznámky k návrhu" sa do výstupu NIKDY nedostane** — skript sa
// zastaví na jej nadpise. Je to jediný dôvod, prečo tu vôbec je vlastný
// konvertor a nie hotová knižnica: obsah tých dokumentov ide von a musí byť
// vidieť, čo presne sa z nich publikuje.
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, 'build');

const pages = JSON.parse(fs.readFileSync(path.join(HERE, 'pages.json'), 'utf8'));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(raw) {
  let s = esc(raw);
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');                 // odkazy na iné .md -> čistý text
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]/g, '<span class="ph">$1</span>');  // nevyplnené zátvorky
  return s;
}

const ANNEX = /^(?:Príloha|Annex)\s+([A-Za-z0-9]+)/;

// Rovnaké pravidlo pre kotvy v texte aj v obsahu, inak by odkazy viedli do prázdna.
function anchorFor(prefix, text, seq) {
  const sec = text.match(/^(\d+)\.\s/);
  if (sec) return prefix + '-s' + sec[1];
  const annex = text.match(ANNEX);
  if (annex) return prefix + '-a' + annex[1].toLowerCase();
  return prefix + '-h' + seq;
}

function convert(arr, prefix) {
  const out = [];
  let i = 0, seq = 0;

  const flushPara = buf => {
    if (!buf.length) return;
    const text = buf.join(' ');
    const m = text.match(/^\*\*(\d+\.\d+)\*\*\s+([\s\S]*)$/);
    if (m) out.push('<p class="clause"><span class="cl-num">' + m[1] + '</span><span class="cl-body">' + inline(m[2]) + '</span></p>');
    else out.push('<p>' + inline(text) + '</p>');
    buf.length = 0;
  };

  while (i < arr.length) {
    const line = arr[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^---+$/.test(line)) { i++; continue; }

    if (/^#{2,6} /.test(line)) {
      const text = line.replace(/^#+\s*/, '');
      const id = anchorFor(prefix, text, seq++);
      // Číslovaný nadpis je paragraf bez ohľadu na úroveň — anglické znenia
      // používajú `###`, slovenské miestami `##`, a rozísť sa nesmú.
      const num = text.match(/^(\d+)\.\s+(.*)$/);
      if (num) out.push('<h3 id="' + id + '"><span class="sec-num">§' + num[1] + '</span>' + inline(num[2]) + '</h3>');
      else out.push('<h2 id="' + id + '">' + inline(text) + '</h2>');
      i++; continue;
    }

    if (line.startsWith('> ')) {
      const buf = [];
      while (i < arr.length && (arr[i].startsWith('> ') || arr[i] === '>')) { buf.push(arr[i].replace(/^>\s?/, '')); i++; }
      const paras = buf.join('\n').split(/\n\s*\n/).filter(Boolean);
      out.push('<aside class="note">' + paras.map(p => '<p>' + inline(p.replace(/\n/g, ' ')) + '</p>').join('') + '</aside>');
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [];
      while (i < arr.length && arr[i].startsWith('|')) { rows.push(arr[i]); i++; }
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const isSep = r => /^\|[\s:|-]+\|$/.test(r);
      const head = isSep(rows[1] || '') ? cells(rows[0]) : null;
      const bodyRows = rows.filter((r, k) => !isSep(r) && !(head && k === 0)).map(cells);
      const headHtml = head && head.some(c => c !== '')
        ? '<thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead>' : '';
      const bodyHtml = '<tbody>' + bodyRows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody>';
      out.push('<div class="tbl-wrap"><table>' + headHtml + bodyHtml + '</table></div>');
      continue;
    }

    if (/^- /.test(line)) {
      const items = [];
      while (i < arr.length && (/^- /.test(arr[i]) || /^\s{2,}\S/.test(arr[i]))) {
        if (/^- /.test(arr[i])) items.push(arr[i].replace(/^- /, ''));
        else items[items.length - 1] += ' ' + arr[i].trim();
        i++;
      }
      out.push('<ul>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</ul>');
      continue;
    }

    const buf = [];
    while (i < arr.length && !/^\s*$/.test(arr[i]) && !arr[i].startsWith('|') && !arr[i].startsWith('> ') && !/^#{2,6} /.test(arr[i]) && !/^---+$/.test(arr[i]) && !/^- /.test(arr[i])) {
      buf.push(arr[i].trim()); i++;
    }
    flushPara(buf);
  }
  return out.join('\n');
}

function toc(arr, prefix) {
  const items = [];
  let seq = 0;
  arr.forEach(l => {
    if (!/^#{2,6} /.test(l)) return;
    const text = l.replace(/^#+\s*/, '');
    const id = anchorFor(prefix, text, seq++);
    const num = text.match(/^(\d+)\.\s+(.*)$/);
    if (num) items.push({ id: id, num: '§' + num[1], text: num[2] });
    else if (ANNEX.test(text)) items.push({ id: id, num: '', text: text });
  });
  return items.map(it => '<li><span class="toc-num">' + it.num + '</span><a href="#' + it.id + '">' + esc(it.text) + '</a></li>').join('');
}

function build(key, cfg, css, script) {
  const lines = fs.readFileSync(path.join(ROOT, 'docs', cfg.doc), 'utf8').split('\n');
  const idxEN = lines.findIndex(l => l.startsWith('# ENGLISH'));
  const idxSK = lines.findIndex(l => l.startsWith('# SLOVENSKY'));
  const idxNotes = lines.findIndex(l => l.startsWith('## Poznámky k návrhu'));
  if (idxEN < 0 || idxSK < 0) throw new Error(cfg.doc + ': chýba hranica ENGLISH/SLOVENSKY');
  if (idxNotes < 0) throw new Error(cfg.doc + ': nenašla sa časť „Poznámky k návrhu" — over, či sa nepremenovala, inak by sa zverejnila');

  const enLines = lines.slice(idxEN + 1, idxSK);
  const skLines = lines.slice(idxSK + 1, idxNotes);

  const html = [
    '<title>' + cfg.pageTitle + '</title>',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600&display=swap">',
    '<style>' + css + '</style>',
    '',
    '<header class="bar">',
    '  <div class="bar-id">',
    '    <span class="bar-name">' + cfg.barName + '</span>',
    '    <span class="chip">' + cfg.chip + '</span>',
    '  </div>',
    '  <div class="switch" role="group" aria-label="Jazyk znenia">',
    '    <button type="button" id="btn-sk" aria-pressed="true">Slovensky<small>preklad</small></button>',
    '    <button type="button" id="btn-en" aria-pressed="false">English<small>záväzné</small></button>',
    '  </div>',
    '</header>',
    '',
    '<main class="sheet">',
    '  <div class="masthead">',
    '    <p class="eyebrow">' + cfg.eyebrow + '</p>',
    '    <h1>' + cfg.h1 + '</h1>',
    '    <p class="lede">' + cfg.lede + '</p>',
    '  </div>',
    '',
    '  <nav class="toc" id="toc-sk" aria-label="Obsah">',
    '    <h2>Obsah</h2>',
    '    <ol>' + toc(skLines, 'sk') + '</ol>',
    '  </nav>',
    '  <nav class="toc" id="toc-en" aria-label="Contents" hidden>',
    '    <h2>Contents</h2>',
    '    <ol>' + toc(enLines, 'en') + '</ol>',
    '  </nav>',
    '',
    '  <article class="doc" id="doc-sk">' + convert(skLines, 'sk') + '</article>',
    '  <article class="doc" id="doc-en" hidden>' + convert(enLines, 'en') + '</article>',
    '',
    '  <footer>' + cfg.footer + '</footer>',
    '</main>',
    '',
    '<script>' + script + '</script>',
  ].join('\n');

  const out = path.join(OUT_DIR, key + '.html');
  fs.writeFileSync(out, html, 'utf8');
  return { out: out, size: html.length };
}

const css = fs.readFileSync(path.join(HERE, 'page.css'), 'utf8');
const script = fs.readFileSync(path.join(HERE, 'page.js'), 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

const only = process.argv[2];
const keys = only ? [only] : Object.keys(pages);
if (only && !pages[only]) throw new Error('neznámy dokument: ' + only + ' (mám ' + Object.keys(pages).join(', ') + ')');

for (const key of keys) {
  const r = build(key, pages[key], css, script);
  console.log(key.padEnd(20) + r.out + '  (' + r.size + ' znakov)');
}
console.log('\nPublikuje sa ako Artifact — URL sú v poznámke v README.md.');
