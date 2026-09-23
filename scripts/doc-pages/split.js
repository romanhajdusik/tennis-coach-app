// Rozdelí dvojjazyčný dokument z `docs/` na dve znenia a odreže internú časť.
// Používa to generátor čitateľských stránok (`build.js`) aj generátor Wordu
// (`docx.js`) — hranice sa nesmú rozísť, inak by jeden z nich zverejnil viac
// než druhý.
//
// Predvolene sú hranice `# ENGLISH`, `# SLOVENSKY` a `## Poznámky k návrhu`.
// Dokument s inou stavbou (napr. texty pre rodičov, kde sú znenia očíslované
// časti) si ich pomenuje sám v `pages.json`:
//
//   "sections": { "en": "## 3. Anglická verzia",
//                 "sk": "## 2. Slovenská verzia",
//                 "end": "## 4." }
//
// **Koncová hranica je povinná.** Keď sa nenájde, skript skončí chybou —
// radšej nezostaví nič, než by ticho poslal von interné poznámky.
module.exports = function split(lines, cfg) {
  const marks = (cfg && cfg.sections) || {
    en: '# ENGLISH',
    sk: '# SLOVENSKY',
    end: '## Poznámky k návrhu',
  };
  const find = prefix => lines.findIndex(l => l.startsWith(prefix));

  const iEn = find(marks.en);
  const iSk = find(marks.sk);
  const iEnd = find(marks.end);
  const doc = (cfg && cfg.doc) || 'dokument';

  if (iEn < 0 || iSk < 0) throw new Error(doc + ': chýba hranica znenia (' + marks.en + ' / ' + marks.sk + ')');
  if (iEnd < 0) throw new Error(doc + ': nenašla sa interná časť („' + marks.end + '") — over, či sa nepremenovala, inak by sa poslala von');

  // Každé znenie končí najbližšou ďalšou hranicou, nech sú v akomkoľvek poradí
  // (v textoch pre rodičov je slovenčina pred angličtinou).
  const bounds = [iEn, iSk, iEnd].sort((a, b) => a - b);
  const endOf = i => bounds.find(b => b > i) ?? lines.length;

  return {
    enLines: lines.slice(iEn + 1, endOf(iEn)),
    skLines: lines.slice(iSk + 1, endOf(iSk)),
  };
};
