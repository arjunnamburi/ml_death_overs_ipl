/* COPY-PASTE: pieces shared by the replay and the worst-balls page.
   - scorecard(): the small scorecard table before a ball
   - probBars(): the chance each model gave each outcome, with the real outcome outlined
   - pushBars(): bars for pushes toward (right) or away from (left) what happened, with the multiplier on hover */

(function () {
  'use strict';
  const S = window.SITE, esc = S.esc;

  // sc: a scorecards_2026.json entry; ball: a replay or worst-ball record
  function scorecard(sc, ball, teamsFull) {
    const bat = sc ? sc.batting : ball.batting;
    const head = '<tr><th>Batting</th><th>Score</th><th>Ball</th><th class="l">Batter</th><th class="l">Non-striker</th>' +
      '<th class="l">Bowler <span class="muted">(O-R-W)</span></th>' + (ball.need != null ? '<th>Chase</th>' : '') + '</tr>';
    const fig = (p) => p ? esc(p[0]) + ' <span class="num">' + p[1] + ' (' + p[2] + ')</span>' : esc(ball.batter);
    const bowl = sc ? esc(sc.bowl[0]) + ' <span class="num">' + sc.bowl[1] + '-' + sc.bowl[2] + '-' + sc.bowl[3] + '</span>' : esc(ball.bowler);
    const chase = ball.need != null
      ? '<td>' + (ball.need > 0 ? 'need ' + ball.need + ' off ' + ball.balls_left : 'won') + '</td>' : '';
    const row = '<tr><td title="' + esc(bat || '') + '"><b>' + esc(S.short(bat || '')) + '</b></td><td class="num">' + esc(ball.score) +
      '</td><td class="num">' + esc(ball.over) + '</td><td class="l">' + fig(sc && sc.bat) + '</td><td class="l">' +
      (sc ? fig(sc.ns) : '–') + '</td><td class="l">' + bowl + '</td>' + chase + '</tr>';
    return '<div class="table-wrap"><table class="scorecard"><caption>Before the ball' +
      (teamsFull ? ': ' + esc(teamsFull) : '') + '. Batter and non-striker: runs (balls).</caption><thead>' + head +
      '</thead><tbody>' + row + '</tbody></table></div>';
  }

  // p: {xgb:[7], lr:[7], b1:[7]}; outcome: '0'...'W'
  function probBars(p, outcome) {
    const models = ['xgb', 'lr', 'b1'];
    const max = Math.max(...models.flatMap(m => p[m]));
    let h = '<div class="pbars" role="table" aria-label="Chance each model gave each outcome"><div class="h" role="columnheader">Out-<br>come</div>' +
      models.map(m => '<div class="h" role="columnheader"><span class="dot ' + m + '"></span>' + (m === 'b1' ? 'B1' : m === 'lr' ? 'Log. reg.' : 'XGBoost') + '</div>').join('');
    S.OUTCOMES.forEach((o, k) => {
      const hit = o === outcome;
      h += '<div class="' + (hit ? 'hit' : '') + '" role="rowheader">' + (o === '0' ? '0 •' : o) + '</div>';
      models.forEach(m => {
        const v = p[m][k];
        h += '<div class="pbar' + (hit ? ' hit-cell' : '') + '" style="' + (hit ? 'outline:2px solid var(--ink);outline-offset:-2px' : '') +
          '" data-tip="' + esc(S.MODELS[m] + ': ' + S.fmt.pct(v) + ' for ' + (o === 'W' ? 'a wicket' : o + (o === '1' ? ' run' : ' runs'))) + '">' +
          '<i style="width:' + (100 * v / max).toFixed(1) + '%;background:var(--' + m + ');opacity:' + (hit ? 1 : .55) + '"></i>' +
          '<span class="' + (hit ? 'hit' : '') + '">' + S.fmt.pct(v) + '</span></div>';
      });
    });
    return h + '</div>';
  }

  // items: [{label, sub, push}], pushes in log-probability units
  function pushBars(items, scaleMax) {
    const max = scaleMax || Math.max(0.5, ...items.map(x => Math.abs(x.push)));
    return '<div class="pushes">' + items.map(x => {
      const w = Math.min(50, 50 * Math.abs(x.push) / max).toFixed(1);
      const cls = x.push >= 0 ? 'pos' : 'neg';
      const lab = (x.push >= 0 ? 'left:calc(50% + ' + w + '% + 4px)' : 'right:calc(50% + ' + w + '% + 4px)');
      return '<div>' + esc(x.label) + (x.sub ? ' <span class="muted">' + esc(x.sub) + '</span>' : '') + '</div>' +
        '<div class="push-track" tabindex="0" data-tip="' + esc('Push ' + S.fmt.signed(x.push) + ' → ' + S.pushWords(x.push)) + '">' +
        '<i class="' + cls + '" style="width:' + w + '%"></i><b style="' + lab + '">' + S.fmt.signed(x.push) + '</b></div>';
    }).join('') + '</div>';
  }

  const PUSH_GUIDE = 'Bars to the right pushed XGBoost toward what happened; bars to the left pushed it away. ' +
    'Rough guide: −0.3 cuts the chance by about a quarter, −0.7 about halves it, −1.4 cuts it to about a quarter. Hover a bar for the exact multiplier.';

  function outcomeWords(o) {
    return { '0': 'Dot ball', '1': '1 run', '2': '2 runs', '3': '3 runs', '4': 'Four', '6': 'Six', 'W': 'Wicket' }[o] || o;
  }

  window.BALL = { scorecard, probBars, pushBars, PUSH_GUIDE, outcomeWords };
})();
