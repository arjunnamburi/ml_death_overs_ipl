/* COPY-PASTE: the match replay.
   Reads data/replay/index.json and data/replay/<match>.json (made by site_export.ipynb),
   plus site/data/matches_2026.json and scorecards_2026.json (made by site_build.ipynb). */

(function () {
  'use strict';
  const S = window.SITE, B = window.BALL, esc = S.esc;
  const ORDER = ['close chase', 'XGBoost best', 'XGBoost worst', 'typical'];   // the tie opens first
  const ROLE_TEXT = {
    'close chase': 'Close chase', 'XGBoost best': 'XGBoost’s best match', 'XGBoost worst': 'XGBoost’s worst match', 'typical': 'A typical match',
  };
  const NOTE = {
    1529281: 'The chase ended in a tie: Mohammed Shami hit the last ball for six to level the scores. KKR won the super over, which isn’t in the ball-by-ball data, so the replay ends on the last ball of the chase.',
  };
  // why XGBoost did well or badly in the best and worst matches (read from the per-ball pushes; not tested)
  const WHY = {
    1535464: ['Why XGBoost did well here', 'Most of its gain came from sixes. D Ferreira hit three sixes in the last over, and XGBoost, which knew his strike rate at the death and his six rate, gave each one about 27% against B1’s 7%. In Gujarat’s chase the target was easy, so XGBoost rightly expected more dots.'],
    1529310: ['Why XGBoost did badly here', 'A likely reading: both teams batted with big hitters (Ishan Kishan, TH David, RM Patidar) and the totals were huge, so XGBoost expected boundaries and gave the many singles, twos and dots too little chance. Most of its loss against B1 came from those balls. Bengaluru’s chase was out of reach, and their batters often rotated the strike instead of swinging. This fits patterns A and C on the Worst-Predicted Balls page.'],
  };
  let M, SC, L, idx, cur = { match: null, inn: 0, ball: 0 };

  Promise.all([S.getJSON('data/replay/index.json'), S.getJSON('site/data/matches_2026.json'),
    S.getJSON('site/data/scorecards_2026.json').catch(() => ({})), S.getJSON('site/data/feature_labels.json')])
    .then(([index, matches, sc, labels]) => {
      idx = index; M = matches; SC = sc; L = labels;
      idx.matches.sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
      const pick = document.getElementById('pick');
      pick.innerHTML = idx.matches.map(m =>
        '<button class="btn" data-id="' + m.match_id + '" aria-pressed="false">' + esc(S.matchName(M, m.match_id)) +
        '<small>' + esc(ROLE_TEXT[m.role] || m.role) + '</small></button>').join('');
      pick.addEventListener('click', e => { const b = e.target.closest('button'); if (b) loadMatch(+b.dataset.id); });
      const want = +(new URLSearchParams(location.search).get('m')) || idx.matches[0].match_id;
      loadMatch(want);
    })
    .catch(err => { document.getElementById('match').innerHTML = '<p class="note">Could not load the replay data (' + esc(err.message) + ').</p>'; });

  function loadMatch(id) {
    document.querySelectorAll('#pick button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.id === id)));
    S.getJSON('data/replay/' + id + '.json').then(R => {
      cur = { match: R, inn: R.innings.length - 1, ball: 0 };
      // open on the first death ball (15.1) of the last innings, so a visitor steps forward through the death overs
      cur.ball = 0;
      renderMatch();
    });
  }

  function finalScore(inn) {
    const last = inn.balls[inn.balls.length - 1];
    const [r, w] = last.score.split('/').map(Number);
    return (r + last.runs) + '/' + (w + (last.wicket ? 1 : 0));
  }

  function renderMatch() {
    const R = cur.match, info = M[String(R.match_id)] || {};
    const totals = R.innings.map(i => esc(S.short(i.batting)) + ' ' + finalScore(i)).join(' · ');
    let h = '<div class="callout"><h2 style="border:0;margin:0;padding:0">' + esc(S.matchName(M, R.match_id)) + '</h2>' +
      '<p class="muted" style="margin:.2rem 0">' + esc(info.venue || R.venue) + ' · ' + esc(ROLE_TEXT[R.role] || R.role) + '</p>' +
      '<p class="result" style="margin:.2rem 0">' + totals + ' <span class="muted" style="font-weight:400">(scores at the end of each innings)</span></p>' +
      (NOTE[R.match_id] ? '<p style="margin:.4rem 0 0">' + esc(NOTE[R.match_id]) + '</p>' : '') +
      (WHY[R.match_id] ? '<p style="margin:.4rem 0 0"><b>' + esc(WHY[R.match_id][0]) + ':</b> ' + esc(WHY[R.match_id][1]).replace('patterns A and C on the Worst-Predicted Balls page', 'patterns A and C on the <a href="worst.html#mechanisms">Worst-Predicted Balls page</a>') + '</p>' : '') +
      '<details style="margin-top:.4rem"><summary class="muted">How these four matches were picked</summary><p class="muted">' + esc(R.rule) + '</p></details></div>';
    h += '<div class="tabs" role="tablist">' + R.innings.map((i, k) =>
      '<button role="tab" aria-selected="' + (k === cur.inn) + '" data-k="' + k + '">' + (k === 0 ? '1st' : '2nd') + ' innings: ' + esc(i.batting) + '</button>').join('') + '</div>';
    h += '<div id="inn"></div>';
    const el = document.getElementById('match'); el.innerHTML = h;
    el.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      cur.inn = +b.dataset.k; cur.ball = 0;
      el.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      renderInnings();
    });
    renderInnings();
  }

  function renderInnings() {
    const inn = cur.match.innings[cur.inn];
    const legal = inn.balls.filter(b => b.legal);
    const last = legal[legal.length - 1];
    const lrGap = last.cum.lr - last.cum.b1;
    const sideX = last.gap_cum < 0 ? 'ahead of' : 'behind', sideL = lrGap < 0 ? 'ahead of' : 'behind';
    let h = '<p>' + esc(inn.batting) + ' were ' + inn.start.runs + '/' + inn.start.wkts + ' after 15 overs' +
      (inn.target ? ', chasing ' + inn.target : '') + '. Over these ' + legal.length + ' legal balls, XGBoost finished <b>' + sideX + ' B1</b> (' +
      S.fmt.signed(last.gap_cum) + ' in total log-loss) and the logistic regression finished <b>' + sideL + ' B1</b> (' + S.fmt.signed(lrGap) + ').</p>';
    h += '<div class="legend"><span><span class="dot xgb"></span>XGBoost minus B1</span><span><span class="dot lr"></span>Logistic regression minus B1</span></div>';
    h += '<p class="muted chart-read">Each line is a model’s total log-loss so far minus B1’s. A line that falls from one ball to the next means that model beat B1 on that ball. Below zero, the model is ahead of B1 so far. Where the blue line is below the orange one, XGBoost is ahead of the logistic regression so far, by the gap between them.</p>';
    h += '<p class="chart-ylab">Running log-loss, model minus B1 (lower is better for the model)</p>';
    h += '<div class="chart" id="chart"></div>';
    h += '<div class="strip" id="strip" role="listbox" aria-label="Deliveries"></div>';
    h += '<div id="ball"></div>';
    document.getElementById('inn').innerHTML = h;
    drawStrip(); drawChart(); showBall(cur.ball);
  }

  function chip(b) {
    if (!b.legal) return (b.extra === 'no-ball' ? 'nb' : 'wd');
    return b.outcome === '0' ? '•' : b.outcome;
  }

  function drawStrip() {
    const inn = cur.match.innings[cur.inn], el = document.getElementById('strip');
    let h = '', over = null;
    inn.balls.forEach((b, k) => {
      const o = b.over.split('.')[0];
      if (o !== over) { if (over !== null) h += '<span class="over-break"></span>'; h += '<span class="over-lab">Over ' + (+o + 1) + '</span>'; over = o; }
      const cls = (b.legal ? 'o' + b.outcome : 'extra') + (b.key ? ' key' : '') + (b.free_hit ? ' fh' : '');
      const tip = b.over + ': ' + (b.legal ? B.outcomeWords(b.outcome) : (b.extra === 'no-ball' ? 'no-ball' : 'wide')) + (b.runs && !b.legal ? ', ' + b.runs + ' run' + (b.runs > 1 ? 's' : '') : '') + (b.free_hit ? ', free hit' : '') +
        (b.key ? ' (one of the 5 balls where XGBoost and B1 differed most)' : '');
      h += '<button role="option" class="' + cls + '" data-k="' + k + '" data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + chip(b) + '</button>';
    });
    el.innerHTML = h;
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) showBall(+b.dataset.k); });
  }

  // the running-total chart: one point per legal ball
  function drawChart() {
    const inn = cur.match.innings[cur.inn];
    const pts = inn.balls.map((b, k) => ({ b, k })).filter(x => x.b.legal);
    const el = document.getElementById('chart');
    const W = Math.max(320, Math.round(el.clientWidth || 760)), H = W < 600 ? 190 : 230, pl = 44, pr = 12, pt = 10, pb = 26;
    const xs = i => pl + (pts.length < 2 ? 0 : i * (W - pl - pr) / (pts.length - 1));
    const vals = pts.flatMap(x => [x.b.gap_cum, x.b.cum.lr - x.b.cum.b1, 0]);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.1 || 0.5; lo -= pad; hi += pad;
    const ys = v => pt + (hi - v) * (H - pt - pb) / (hi - lo);
    const ticks = niceTicks(lo, hi, 4);
    const line = f => pts.map((x, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ',' + ys(f(x.b)).toFixed(1)).join('');
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Running total of log-loss minus B1 for XGBoost and logistic regression">';
    s += '<g class="grid">' + ticks.map(t => '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + ys(t) + '" y2="' + ys(t) + '"/>').join('') + '</g>';
    s += '<line class="zero" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + ys(0) + '" y2="' + ys(0) + '"/>';
    s += '<g class="axis">' + ticks.map(t => '<text x="' + (pl - 6) + '" y="' + (ys(t) + 4) + '" text-anchor="end">' + S.fmt.signed(t, 1).replace('+0.0', '0') + '</text>').join('');
    let lastOver = null;
    pts.forEach((x, i) => { const o = x.b.over.split('.')[0]; if (o !== lastOver) { s += '<text x="' + xs(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + (+o + 1) + '</text>'; lastOver = o; } });
    s += '<text x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">over</text></g>';
    s += '<path d="' + line(b => b.cum.lr - b.cum.b1) + '" fill="none" stroke="var(--lr)" stroke-width="2"/>';
    s += '<path d="' + line(b => b.gap_cum) + '" fill="none" stroke="var(--xgb)" stroke-width="2"/>';
    s += '<line id="cross" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--ink-3)" stroke-dasharray="3 3" visibility="hidden"/>';
    s += '<circle id="selx" r="5" fill="var(--xgb)" stroke="var(--bg)" stroke-width="2"/><rect id="sell" width="9" height="9" fill="var(--lr)" stroke="var(--bg)" stroke-width="2"/>';
    s += '<rect id="hit" x="' + pl + '" y="0" width="' + (W - pl - pr) + '" height="' + H + '" fill="transparent" style="cursor:pointer"/></svg>';
    el.innerHTML = s;
    const svg = el.querySelector('svg'), cross = svg.querySelector('#cross'), tip = document.querySelector('.tip');
    const nearest = e => {
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
      return Math.max(0, Math.min(pts.length - 1, Math.round((x - pl) / ((W - pl - pr) / Math.max(1, pts.length - 1)))));
    };
    svg.addEventListener('mousemove', e => {
      const i = nearest(e), b = pts[i].b;
      cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = '<b>' + b.over + '</b> ' + esc(b.bowler) + ' to ' + esc(b.batter) + ': ' + B.outcomeWords(b.outcome) +
        '<br><span class="dot xgb"></span>XGBoost − B1 ' + S.fmt.signed(b.gap_cum) + '<br><span class="dot lr"></span>Log. reg. − B1 ' + S.fmt.signed(b.cum.lr - b.cum.b1) +
        '<br>Click to open this ball';
      tip.style.display = 'block'; tip.style.left = Math.min(e.clientX + 14, innerWidth - 230) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
    });
    svg.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; });
    svg.addEventListener('click', e => showBall(pts[nearest(e)].k));
    drawChart.mark = k => {
      let i = pts.findIndex(x => x.k >= k); if (i < 0) i = pts.length - 1;
      const b = pts[i].b;
      svg.querySelector('#selx').setAttribute('cx', xs(i)); svg.querySelector('#selx').setAttribute('cy', ys(b.gap_cum));
      svg.querySelector('#sell').setAttribute('x', xs(i) - 4.5); svg.querySelector('#sell').setAttribute('y', ys(b.cum.lr - b.cum.b1) - 4.5);
    };
  }

  function niceTicks(lo, hi, n) {
    const step0 = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= step0);
    const out = []; for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(6));
    return out;
  }

  function showBall(k) {
    const inn = cur.match.innings[cur.inn], b = inn.balls[k]; cur.ball = k;
    document.querySelectorAll('#strip button').forEach(x => x.setAttribute('aria-current', String(+x.dataset.k === k)));
    if (drawChart.mark) drawChart.mark(k);
    const key = cur.match.match_id + '|' + inn.innings + '|' + b.over + '|' + inn.balls.slice(0, k).filter(x => x.over === b.over).length;
    const sc = SC[key];
    const out = b.legal ? b.outcome : (b.extra === 'no-ball' ? 'no-ball' : 'wide') + ', ' + b.runs + ' run' + (b.runs === 1 ? '' : 's');
    let h = '<div class="card"><div class="ball-head"><h3>' + esc(b.over) + ' · ' + esc(b.bowler) + ' to ' + esc(b.batter) + ' · Outcome: ' + esc(out) + '</h3>';
    if (b.key) h += '<span class="tag own">Big difference between XGBoost and B1</span>';
    if (b.free_hit) h += '<span class="tag">Free hit</span>';
    if (b.new_batter) h += '<span class="tag">First ball faced</span>';
    h += '<span class="nav-ball"><button class="btn" id="prev" aria-label="Previous ball">← Prev</button><button class="btn" id="next" aria-label="Next ball">Next →</button></span></div>';
    h += B.scorecard(sc, b, '');
    if (!b.legal) {
      h += '<p class="muted">Not a legal ball, so no model predicts it. The same ball number is bowled again.</p>';
    } else {
      h += '<p class="explain">' + explain(b) + '</p>';
      h += '<div class="grid2"><div><h4 style="margin:.3rem 0">What each model expected</h4>' + B.probBars(b.p, b.outcome) +
        '<div class="losses">' + ['xgb', 'lr', 'b1'].map(m => '<span data-tip="Log-loss = −log(chance given to what happened). Lower is better."><span class="dot ' + m + '"></span>' +
          (m === 'b1' ? 'B1' : m === 'lr' ? 'Log. reg.' : 'XGBoost') + ' log-loss <b class="num">' + (+b.loss[m]).toFixed(2) + '</b></span>').join('') + '</div></div>';
      h += '<div><h4 style="margin:.3rem 0">Why XGBoost thought so: the three biggest pushes</h4>' +
        B.pushBars(b.why.map(w => ({ label: S.featLabel(L, w.f), sub: '= ' + S.featValue(L, w.f, w.value), push: w.push }))) + '</div></div>';
    }
    h += '</div>';
    document.getElementById('ball').innerHTML = h;
    document.getElementById('prev').disabled = k === 0;
    document.getElementById('next').disabled = k === inn.balls.length - 1;
    document.getElementById('prev').onclick = () => showBall(k - 1);
    document.getElementById('next').onclick = () => showBall(k + 1);
  }

  // one plain sentence per ball: who gave what happened the higher chance, and the features
  // that moved XGBoost most in the direction that decided the ball
  const NOUN = { '0': 'a dot', '1': 'a single', '2': 'two runs', '3': 'three runs', '4': 'a four', '6': 'a six', 'W': 'a wicket' };
  function explain(b) {
    const k = S.OUTCOMES.indexOf(b.outcome), px = b.p.xgb[k], pb = b.p.b1[k], d = b.x_minus_b1;
    const what = NOUN[b.outcome];
    const feat = w => {
      let lab = S.featLabel(L, w.f); if (/^[A-Z][a-z]/.test(lab)) lab = lab[0].toLowerCase() + lab.slice(1);
      return esc(lab) + ' (' + esc(S.featValue(L, w.f, w.value)) + ')';
    };
    if (Math.abs(d) < 0.05) return 'XGBoost and B1 gave ' + what + ' about the same chance (' + S.fmt.pct(px) + ' and ' + S.fmt.pct(pb) + ').';
    const better = d < 0, size = Math.abs(d) < 0.15 ? 'slightly ' : Math.abs(d) >= 0.5 ? 'much ' : '';
    let t = 'XGBoost put ' + S.fmt.pct(px) + ' on ' + what + ' and B1 ' + S.fmt.pct(pb) + ', so <b>' +
      (better ? 'XGBoost did ' + size + 'better' : 'B1 did ' + size + 'better') + '</b> on this ball. ';
    const same = b.why.filter(w => better ? w.push > 0 : w.push < 0).slice(0, 2);
    if (same.length) t += 'What ' + (better ? 'raised' : 'lowered') + ' XGBoost’s chance most: ' + same.map(feat).join(' and ') + '.';
    else t += 'None of XGBoost’s three biggest pushes point that way; many small ones added up.';
    return t;
  }

  document.addEventListener('keydown', e => {
    if (!cur.match || e.target.closest('input, select, textarea')) return;
    const n = cur.match.innings[cur.inn].balls.length;
    if (e.key === 'ArrowRight' && cur.ball < n - 1) { showBall(cur.ball + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft' && cur.ball > 0) { showBall(cur.ball - 1); e.preventDefault(); }
  });
})();
