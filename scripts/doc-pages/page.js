(function () {
  var sk = document.getElementById('btn-sk');
  var en = document.getElementById('btn-en');
  var panes = {
    sk: [document.getElementById('doc-sk'), document.getElementById('toc-sk')],
    en: [document.getElementById('doc-en'), document.getElementById('toc-en')]
  };

  function show(lang, updateHash) {
    var other = lang === 'sk' ? 'en' : 'sk';
    panes[lang].forEach(function (el) { el.hidden = false; });
    panes[other].forEach(function (el) { el.hidden = true; });
    sk.setAttribute('aria-pressed', String(lang === 'sk'));
    en.setAttribute('aria-pressed', String(lang === 'en'));
    document.documentElement.lang = lang;
    if (updateHash && history.replaceState) {
      history.replaceState(null, '', lang === 'en' ? '#english' : '#slovensky');
    }
  }

  // Odkaz priamo na jedno znenie: #english, #slovensky alebo ktorákoľvek kotva (#en-s5).
  var hash = (location.hash || '').toLowerCase();
  if (hash.indexOf('#en') === 0) {
    show('en', false);
    var target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }

  sk.addEventListener('click', function () { show('sk', true); });
  en.addEventListener('click', function () { show('en', true); });
})();
