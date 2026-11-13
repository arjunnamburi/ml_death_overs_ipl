/* COPY-PASTE: shared code for every page.
   - the light/dark theme (follows the system, with a toggle that is remembered)
   - the header and navigation (one copy here, so every page matches)
   - small helpers: loading JSON and CSV, number formats, match names, feature labels, the tooltip
   Each page sets <body data-root="..." data-page="..."> so links work from the home page and from site/. */

(function () {
  'use strict';
  const body = document.body;
  const ROOT = body.dataset.root || '';
  const PAGE = body.dataset.page || '';
  const REPO = 'https://github.com/arjunnamburi/ml_death_overs_ipl';

  /* ---------- theme ---------- */
  function storedTheme() { try { return localStorage.getItem('theme'); } catch (e) { return null; } }
  function saveTheme(t) { try { t ? localStorage.setItem('theme', t) : localStorage.removeItem('theme'); } catch (e) { /* private window */ } }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  function effectiveTheme() {
    const t = document.documentElement.dataset.theme;
    return t === 'light' || t === 'dark' ? t : (media.matches ? 'dark' : 'light');
  }
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const eff = effectiveTheme();
    // every figure has a light and a dark version: <img data-fig="site/img/drift_sixes"> (or "fig1_..." for img/)
    document.querySelectorAll('img[data-fig]').forEach(img => {
      const f = img.dataset.fig;
      img.src = ROOT + (f.includes('/') ? '' : 'img/') + f + '_' + eff + '.svg';
    });
    const btn = document.querySelector('.theme-btn');
    if (btn) {
      btn.textContent = eff === 'dark' ? '☀ Light' : '☾ Dark';
      btn.setAttribute('aria-label', 'Switch to ' + (eff === 'dark' ? 'light' : 'dark') + ' theme');
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: eff }));
  }
  media.addEventListener('change', () => applyTheme(storedTheme()));

  /* ---------- header ---------- */
  const PAGES = [
    ['report', 'Report', ROOT + 'index.html'],
    ['replay', 'Match Replay', ROOT + 'site/replay.html'],
    ['worst', 'Worst-Predicted Balls', ROOT + 'site/worst.html'],
    ['extras', 'Extras', ROOT + 'site/extras.html'],
  ];
  const header = document.createElement('header');
  header.className = 'top';
  header.innerHTML =
    '<div class="top-inner">' +
    '<a class="brand" href="' + ROOT + 'index.html">Ball-by-Ball Outcome Prediction in IPL</a>' +
    '<nav class="nav" aria-label="Pages">' +
    PAGES.map(([id, name, href]) =>
      '<a href="' + href + '"' + (id === PAGE ? ' aria-current="page"' : '') + '>' + name + '</a>').join('') +
    '</nav><button class="theme-btn" type="button"></button></div>';
  body.prepend(header);
  header.querySelector('.theme-btn').addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    saveTheme(next); applyTheme(next);
  });


  applyTheme(storedTheme());
  // the 'how to read' boxes start open on a laptop and closed on a phone
  if (window.innerWidth < 700) document.querySelectorAll('details.howto[open]').forEach(d => d.removeAttribute('open'));

  /* ---------- tooltip ---------- */
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.setAttribute('role', 'tooltip');
  body.append(tip);
  function showTip(e, html) {
    tip.innerHTML = html; tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }
  // any element with data-tip="..." gets the tooltip on hover and on focus
  // (charts can drive the same tooltip themselves; this only hides what it showed)
  let fromAttr = false;
  document.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-tip]');
    if (el) { showTip(e, el.dataset.tip); fromAttr = true; } else if (fromAttr) { hideTip(); fromAttr = false; }
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest('[data-tip]'); if (!el) return;
    const r = el.getBoundingClientRect(); showTip({ clientX: r.left, clientY: r.bottom }, el.dataset.tip);
  });
  document.addEventListener('focusout', hideTip);

  /* ---------- loading data ---------- */
  const cache = {};
  function getJSON(path) {
    if (!cache[path]) cache[path] = fetch(ROOT + path).then(r => {
      if (!r.ok) throw new Error(path + ': ' + r.status); return r.json();
    });
    return cache[path];
  }
  function parseCSV(text) {          // handles quoted fields with commas
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const head = rows.shift();
    return rows.filter(r => r.length > 1 || r[0] !== '').map(r => Object.fromEntries(head.map((h, j) => [h, r[j]])));
  }
  function getCSV(path) {
    if (!cache[path]) cache[path] = fetch(ROOT + path).then(r => {
      if (!r.ok) throw new Error(path + ': ' + r.status); return r.text();
    }).then(parseCSV);
    return cache[path];
  }

  /* ---------- formats ---------- */
  const num = v => (v === '' || v == null ? NaN : +v);
  const fmt = {
    ll: v => isNaN(num(v)) ? '–' : num(v).toFixed(4),                       // log-loss: 4 decimals
    diff: v => fmt.signed(v, 4),
    pct: p => { p = num(p) * 100; return isNaN(p) ? '–' : (p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%'; }, // from a probability
    pctv: p => { p = num(p); return isNaN(p) ? '–' : (p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%'; },       // already in %
    int: v => isNaN(num(v)) ? '–' : Math.round(num(v)).toLocaleString('en-US'),
    signed: (v, d = 2) => {                                                    // +0.12 / −0.12 / 0.00 (no sign once rounded to zero)
      v = num(v); if (isNaN(v)) return '–';
      const a = Math.abs(v).toFixed(d); return (+a === 0 ? '' : v > 0 ? '+' : '−') + a;
    },
    ci: (lo, hi) => '[' + fmt.diff(lo) + ', ' + fmt.diff(hi) + ']',
  };

  /* ---------- names ---------- */
  const SHORT = {
    'Chennai Super Kings': 'CSK', 'Delhi Capitals': 'DC', 'Gujarat Titans': 'GT', 'Kolkata Knight Riders': 'KKR',
    'Lucknow Super Giants': 'LSG', 'Mumbai Indians': 'MI', 'Punjab Kings': 'PBKS', 'Rajasthan Royals': 'RR',
    'Royal Challengers Bengaluru': 'RCB', 'Royal Challengers Bangalore': 'RCB', 'Sunrisers Hyderabad': 'SRH',
  };
  const short = t => SHORT[t] || t;
  const MODELS = { xgb: 'XGBoost', lr: 'Logistic regression', b1: 'Scorecard baseline (B1)' };
  const OUTCOMES = ['0', '1', '2', '3', '4', '6', 'W'];
  const OUTCOME_NAME = { '0': 'dot', '1': 'single', '2': 'two', '3': 'three', '4': 'four', '6': 'six', 'W': 'wicket' };

  // matches_2026.json: { "1529281": { "no": 38, "label": "Match 38", "teams": [...], ... } }
  function matchName(m, id) {
    const x = m && m[String(id)];
    if (!x) return '2026 match';
    const t = x.teams && x.teams.length === 2 ? x.teams.join(' vs ') + ', ' : '';
    return t + x.label;
  }

  // feature_labels.json: { features: { name: { label, group, fmt } } }
  function featLabel(L, f) { return (L && L.features && L.features[f] && L.features[f].label) || f.replace(/_/g, ' '); }
  function featValue(L, f, v) {
    const k = L && L.features && L.features[f] && L.features[f].fmt;
    if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) return 'n/a';
    if (k === 'pct') return (v * 100).toFixed(1) + '%';
    if (k === 'int') return Math.round(v).toLocaleString('en-US');
    if (k === 'dec1') return (+v).toFixed(1);
    if (k === 'dec2') return (+v).toFixed(2);
    if (k === 'bool') return v ? 'yes' : 'no';
    if (k === 'cat') {
      const c = L.categories && L.categories[f]; return (c && (c[v] || c[String(v)])) || String(v);
    }
    return typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : (+v.toFixed(3)).toString()) : String(v);
  }

  // a push is a change in XGBoost's score (margin) for what happened, not in its chance:
  // softmax turns all seven scores into chances together, so the chance also depends on the other six
  function pushWords(x) {
    if (Math.abs(x) < 0.005) return 'barely moves the score of what happened';
    return (x > 0 ? 'raises' : 'lowers') + ' XGBoost’s score for what happened by ' + Math.abs(x).toFixed(2) + ' (a score, not a chance)';
  }

  // XGBoost's chance of each outcome before any feature pushes: the softmax of the seven base values
  // of pred_contribs for the 2026 model (the same for every ball), in %
  const BASE_PCT = { '0': 30.46, '1': 39.95, '2': 6.65, '3': 0.31, '4': 12.23, '6': 5.27, 'W': 5.13 };

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  window.SITE = { ROOT, PAGE, REPO, getJSON, getCSV, fmt, short, MODELS, OUTCOMES, OUTCOME_NAME, matchName,
    featLabel, featValue, pushWords, BASE_PCT, esc, effectiveTheme };
})();

// when the page is printed or saved as a PDF, open every collapsed section, then close them again
(function () {
  let opened = [];
  window.addEventListener('beforeprint', () => {
    opened = [...document.querySelectorAll('details:not([open])')];
    opened.forEach(d => { d.open = true; });
  });
  window.addEventListener('afterprint', () => { opened.forEach(d => { d.open = false; }); opened = []; });
})();
