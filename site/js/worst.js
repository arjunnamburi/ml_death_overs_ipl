/* COPY-PASTE: the worst-predicted balls page.
   Reads data/worst_balls_death_2026.json (site_export.ipynb), site/data/hypotheses.json (the written hypotheses),
   site/data/matches_2026.json and scorecards_2026.json (site_build.ipynb) and site/data/feature_labels.json. */

(function () {
  'use strict';
  const S = window.SITE, B = window.BALL, esc = S.esc;
  const INTRO = {
    top10_loss: 'The ten 2026 death balls with XGBoost’s highest log-loss: the outcomes it thought least likely.',
    top10_vs_B1: 'The ten balls where XGBoost’s log-loss was furthest above B1’s: where reading more context hurt most.',
    top3_per_outcome: 'For each outcome, the three balls where XGBoost gave the real outcome the lowest chance.',
  };
  let W, H, M, SC, L, scale;

  Promise.all([S.getJSON('data/worst_balls_death_2026.json'), S.getJSON('site/data/hypotheses.json'),
    S.getJSON('site/data/matches_2026.json'), S.getJSON('site/data/scorecards_2026.json').catch(() => ({})),
    S.getJSON('site/data/feature_labels.json')])
    .then(([w, h, m, sc, l]) => {
      W = w; H = h; M = m; SC = sc; L = l;
      scale = Math.max(...W.balls.flatMap(b => Object.values(b.group_push).map(Math.abs)));
      document.getElementById('reading').textContent = H.reading_pushes;
      renderMechs();
      const tabs = document.getElementById('tabs');
      tabs.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
        renderList(b.dataset.list);
      });
      renderList('top10_loss');
    })
    .catch(err => { document.getElementById('list').innerHTML = '<p class="note">Could not load the data (' + esc(err.message) + ').</p>'; });

  const hypOf = b => H.balls.find(x => x.match_id === b.match_id && x.innings === b.innings && x.over === b.over);

  function tag(b) {
    const x = b.p_actual_pct.xgb, b1 = b.p_actual_pct.b1;
    if (b1 < 1) return '<span class="tag rare" data-tip="Even the scorecard baseline gave this under 1%.">Rare for every model</span>';
    if (b1 >= 2 * x) return '<span class="tag own" data-tip="B1 gave it at least twice XGBoost’s chance.">XGBoost’s own miss</span>';
    return '<span class="tag" data-tip="XGBoost and B1 both rated it low.">Shared miss</span>';
  }

  function scKey(b) {
    // worst balls are legal: the scorecard key ends with the order of this delivery within its over label
    const pre = b.match_id + '|' + b.innings + '|' + b.over + '|';
    const ks = Object.keys(SC).filter(k => k.startsWith(pre)).sort();
    return ks[ks.length - 1];
  }

  function card(b, rank) {
    const hy = hypOf(b), info = M[String(b.match_id)] || {};
    const r2 = v => Math.round(v * 100) / 100;
    const pos = r2(Object.values(b.group_push).filter(v => v > 0).reduce((a, v) => a + v, 0));
    const neg = r2(Object.values(b.group_push).filter(v => v < 0).reduce((a, v) => a + v, 0));
    const groups = Object.entries(b.group_push).sort((a, c) => a[1] - c[1]);
    let h = '<article class="card ball-card" id="ball-' + b.id + '">';
    h += '<h3><span class="rank">' + rank + '.</span>' + esc(B.outcomeWords(b.outcome)) + ': ' + esc(b.bowler) + ' to ' + esc(b.batter) + '</h3>';
    h += '<p class="meta">' + esc(S.matchName(M, b.match_id)) + ' · ' + (b.innings === 1 ? '1st' : '2nd') + ' innings · ball ' + esc(b.over) + '</p>';
    h += '<div>' + tag(b) + (b.new_batter ? '<span class="tag">First ball faced</span>' : '') + (b.free_hit ? '<span class="tag">Free hit</span>' : '') + '</div>';
    h += B.scorecard(SC[scKey(b)], b, info.teams ? info.teams.join(' vs ') : '');
    h += '<div class="chance">Chance given to what happened: ' + ['xgb', 'lr', 'b1'].map(m =>
      '<span><span class="dot ' + m + '"></span>' + (m === 'xgb' ? 'XGBoost' : m === 'lr' ? 'Log. reg.' : 'B1') + ' <b>' + S.fmt.pctv(b.p_actual_pct[m]) + '</b></span>').join('') +
      '<span>XGBoost log-loss <b>' + S.fmt.ll(b.loss.xgb) + '</b></span></div>';
    if (hy) {
      const mech = H.mechanisms[hy.mechanism];
      h += '<div class="hyp"><b>Hypothesis.</b> ' + esc(hy.line) + ' <a href="#mech-' + hy.mechanism + '">Pattern ' + hy.mechanism + ': ' + esc(mech.title) + ' →</a></div>';
    }
    h += '<h4 style="margin:.6rem 0 .2rem">What pushed XGBoost, by feature group</h4>';
    h += '<p class="net">Net push <b>' + S.fmt.signed(pos + neg) + '</b> = ' + S.fmt.signed(pos) + ' toward what happened ' + S.fmt.signed(neg).replace('−', '− ') +
      ' away from it <span class="muted">(' + esc(S.pushWords(pos + neg)) + ', against XGBoost’s guess for an average ball)</span></p>';
    const big = groups.filter(([, v]) => Math.abs(v) >= 0.05), small = groups.filter(([, v]) => Math.abs(v) < 0.05);
    h += B.pushBars(big.map(([g, v]) => ({ label: g.charAt(0).toUpperCase() + g.slice(1), push: v })), scale);
    if (small.length) h += '<p class="muted" style="font-size:.85rem;margin:.3rem 0 0">' + small.length + ' more group' + (small.length > 1 ? 's' : '') +
      ' pushed less than 0.05 each (' + esc(small.map(([g, v]) => g + ' ' + S.fmt.signed(v)).join(', ')) + ').</p>';
    h += '<details class="more"><summary>Show the single features and every outcome’s chance</summary>';
    h += '<h4 style="margin:.6rem 0 .2rem">The three features that pushed hardest away from what happened</h4>' +
      B.pushBars(b.pushed_away.map(w => ({ label: S.featLabel(L, w.f), sub: '= ' + S.featValue(L, w.f, w.value), push: w.push })), scale);
    h += '<h4 style="margin:.8rem 0 .2rem">What each model expected</h4>' + B.probBars(b.p, b.outcome) + '</details>';
    h += '<p class="muted" style="font-size:.85rem;margin-top:.6rem">' + esc(B.PUSH_GUIDE) + '</p>';
    return h + '</article>';
  }

  function renderList(name) {
    document.getElementById('list-intro').textContent = INTRO[name];
    const balls = W.lists[name].map(id => W.balls.find(b => b.id === id));
    let h = '';
    if (name === 'top3_per_outcome') {
      S.OUTCOMES.forEach(o => {
        const g = balls.filter(b => b.outcome === o); if (!g.length) return;
        h += '<h3>' + { '0': 'Dot balls', '1': 'Singles', '2': 'Twos', '3': 'Threes', '4': 'Fours', '6': 'Sixes', 'W': 'Wickets' }[o] + '</h3>';
        g.forEach((b, i) => { h += card(b, i + 1); });
      });
    } else {
      balls.forEach((b, i) => { h += card(b, i + 1); });
    }
    document.getElementById('list').innerHTML = h;
    const note = document.getElementById('list-note');
    const threes = balls.filter(b => b.outcome === '3').length;
    if (name === 'top10_loss') {
      note.innerHTML = '<b>Why so many threes?</b> ' + threes + ' of these ' + balls.length + ' balls are threes. ' +
        'A three happens on only about 0.3% of balls, so every model gives it a tiny chance, and a tiny chance means a large log-loss when one happens. ' +
        balls.filter(b => b.p_actual_pct.b1 < 1).length + ' of the ' + balls.length + ' are tagged <i>Rare for every model</i>: hard balls for any model, not only for XGBoost. ' +
        'The other two lists show more of where XGBoost’s own reading went wrong.';
      note.hidden = false;
    } else if (name === 'top10_vs_B1') {
      note.innerHTML = 'These are the balls where XGBoost’s extra context cost it most against B1, which only knows the phase, the wickets band and the innings.';
      note.hidden = false;
    } else note.hidden = true;
  }

  function renderMechs() {
    const el = document.getElementById('mechs');
    el.innerHTML = Object.entries(H.mechanisms).map(([k, m]) => {
      const mine = H.balls.filter(b => b.mechanism === k);
      return '<article class="card mech" id="mech-' + k + '"><h3><span class="letter">' + k + '</span>' + esc(m.title) + '</h3>' +
        '<p class="muted" style="margin-top:0">Shared by ' + mine.length + ' ball' + (mine.length === 1 ? '' : 's') + ': ' +
        mine.map(b => esc(b.batter) + ' (' + esc(b.outcome === 'W' ? 'wicket' : b.outcome) + ')').join(', ') + '</p>' +
        '<p>' + esc(m.text) + '</p>' +
        (m.check ? '<p class="muted"><b>Check, still to run:</b> ' + esc(m.check.replace(/^S4b check [A-D] \(H1\):\s*/, '')) + '</p>' : '') + '</article>';
    }).join('');
  }
})();
