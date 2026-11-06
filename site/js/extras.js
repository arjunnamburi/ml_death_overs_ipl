/* COPY-PASTE: the Extras page.
   Reads data/players_2026.json, data/ablation_groups.csv, data/ablation_blocks.csv, data/matchup_ablation.csv
   (all made earlier) and site/data/matches_2026.json (site_build.ipynb). */

(function () {
  'use strict';
  const S = window.SITE, F = S.fmt, esc = S.esc;
  const GROUP = {
    delivery: 'Delivery', chase: 'Chase pressure', partnership: 'Partnership', striker: 'Striker form',
    bowler_spell: 'Bowler spell', momentum: 'Momentum', hist_8_batter: 'Batter history', hist_9_bowler: 'Bowler history',
    hist_10_base: 'Matchup and base rates', hist_11_venue_season: 'Venue and season',
    all_inmatch_context: 'All in-match context', all_history: 'All history',
  };
  const REPLAY = [1529281, 1535464, 1529310, 1529291];
  const table = (head, rows, caption) => '<div class="table-wrap"><table><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
    (caption ? '<p class="muted" style="font-size:.85rem;margin-top:-.6rem">' + caption + '</p>' : '');
  const ci = (lo, hi, d = 4) => '<span class="muted" style="font-size:.85em">[' + F.signed(lo, d) + ', ' + F.signed(hi, d) + ']</span>';

  /* ---------- players ---------- */
  // headings and the one-line reading above each table (written after looking at the tables)
  const LIST = {
    bat_best_read: ['Batters XGBoost Reads Best', 'Mostly big hitters. Even XGBoost expected too little from them, but it expected far more than B1, which treats every batter the same.'],
    bat_worst_read: ['Batters XGBoost Reads Worst', 'Mostly batters who scored slower than expected. XGBoost probably leaned on their history, which pointed the wrong way, so it did no better than B1.'],
    bat_runs_above_exp: ['Batters Who Beat the Expected Runs Most', 'Mostly the same hitters as the best-read list: for batters, beating expectations goes with being read well.'],
    bowl_best_read: ['Bowlers XGBoost Reads Best', 'Small samples of about 20 to 26 overs each, so read this list with care. Most of them conceded more than expected.'],
    bowl_worst_read: ['Bowlers XGBoost Reads Worst', 'Mostly bowlers who conceded far fewer runs than expected. The model barely tells bowlers apart, so an unusually tight season looks average to it.'],
    bowl_runs_below_exp: ['Bowlers Who Conceded Least Against Expected', 'Overlaps with the worst-read list: for bowlers, beating expectations goes with being read badly, the opposite of batters.'],
  };
  S.getJSON('data/players_2026.json').then(P => {
    const s = P.summary;
    document.getElementById('players-summary').textContent =
      s.bat.players + ' batters (at least ' + P.min_balls.bat + ' balls faced) and ' + s.bowl.players + ' bowlers (at least ' + P.min_balls.bowl +
      ' balls bowled) in 2026, all overs. XGBoost reads ' + s.bat.read_better_than_B1 + ' of the batters and ' + s.bowl.read_better_than_B1 +
      ' of the bowlers clearly better than B1, and no player clearly worse.';
    document.getElementById('players-notes').innerHTML = P.notes.map(n => '<li>' + esc(n.charAt(0).toUpperCase() + n.slice(1)) + '</li>').join('');
    const render = side => {
      const lists = Object.entries(P.lists).filter(([k]) => k.startsWith(side + '_'));
      document.getElementById('players-lists').innerHTML = lists.map(([key, L]) => {
        const bowl = side === 'bowl';
        const head = ['Player', 'Balls', 'Gain vs B1 [95%]',
          bowl ? 'Strike rate conceded vs expected' : 'Strike rate vs expected', bowl ? 'Runs conceded vs expected' : 'Runs vs expected',
          bowl ? 'Sixes conceded vs expected' : 'Sixes vs expected', bowl ? 'Wickets vs expected' : 'Dismissals vs expected'];
        const rows = L.players.map(p => ['<b>' + esc(p.player) + '</b>', p.balls, F.signed(p.gain, 4) + ' ' + ci(p.gain_low, p.gain_high),
          F.signed(p.sr_above_exp, 1) + ' ' + ci(p.sr_low, p.sr_high, 1), F.signed(p.runs_above_exp, 0),
          F.signed(p.sixes_above_exp, 1), F.signed(p.wkts_above_exp, 1) + ' ' + ci(p.wkts_low, p.wkts_high, 1)]);
        const [title, line] = LIST[key] || [L.title, ''];
        return '<h3>' + esc(title) + '</h3>' + (line ? '<p class="inf">' + esc(line) + '</p>' : '') + table(head, rows);
      }).join('');
    };
    document.getElementById('ptabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      document.querySelectorAll('#ptabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      render(b.dataset.side);
    });
    render('bat');
  }).catch(err => { document.getElementById('players-lists').textContent = 'Could not load the player tables (' + err.message + ').'; });

  /* ---------- matches ---------- */
  S.getJSON('site/data/matches_2026.json').then(M => {
    const ms = Object.entries(M).filter(([, m]) => m.scored).map(([id, m]) => ({ id: +id, ...m }))
      .sort((a, b) => a.ll_xgb_all - b.ll_xgb_all);
    const head = ['Match', 'Balls', 'XGBoost log-loss', 'Gain vs B1', 'Death balls', 'Death log-loss', 'Death gain vs B1'];
    const row = m => ['<b>' + esc(S.matchName(M, m.id)) + '</b>' + (REPLAY.includes(m.id) ? ' · <a href="replay.html?m=' + m.id + '">replay</a>' : ''),
      m.balls_all, F.ll(m.ll_xgb_all), F.signed(m.gain_vs_b1_all, 4), m.balls_death || '–', F.ll(m.ll_xgb_death), F.signed(m.gain_vs_b1_death, 4)];
    document.getElementById('matches-tables').innerHTML =
      '<h3>Most Predictable</h3>' + table(head, ms.slice(0, 5).map(row)) +
      '<h3>Least Predictable</h3>' + table(head, ms.slice(-5).reverse().map(row),
        ms.length + ' scored matches; the 3 rain-affected 2026 matches are left out. A match’s log-loss depends on how the game went as much as on the model: a one-sided chase is easier to read than a collapse.');
  });

  /* ---------- ablations ---------- */
  const verdictCell = r => {
    const helps = /helps/.test(r.verdict);
    return '<span class="' + (helps ? 'verdict-yes' : 'verdict-mixed') + '">' + esc(r.verdict) + '</span>' + (r.bonferroni === 'True' ? ' <span class="tag">Bonferroni</span>' : '');
  };
  const ablTable = (rows, nameKey, names) => {
    const keys = [...new Set(rows.map(r => r[nameKey]))];
    const head = ['Dropped', 'Features', 'Season', 'Death change [95%]', 'Death verdict', 'All-ball change [95%]', 'All-ball verdict'];
    const out = [];
    keys.forEach(k => ['2025', '2026'].forEach(season => {
      const d = rows.find(r => r[nameKey] === k && r.season === season && r.balls === 'death');
      const a = rows.find(r => r[nameKey] === k && r.season === season && r.balls === 'all');
      if (!d || !a) return;
      out.push([season === '2025' ? '<b>' + esc(names ? (names[k] || k) : k) + '</b>' : '', season === '2025' ? d.n_feats : '', season,
        F.signed(d.loss_if_dropped, 4) + ' ' + ci(d.low, d.high), verdictCell(d), F.signed(a.loss_if_dropped, 4) + ' ' + ci(a.low, a.high), verdictCell(a)]);
    }));
    return table(head, out, 'Positive change = log-loss went up without the group, so the group was helping. 2025: refit on 2008-2024, scored on 2025. 2026: refit on 2008-2025, scored on 2026.');
  };
  S.getCSV('data/ablation_groups.csv').then(r => { document.getElementById('abl-groups').innerHTML = ablTable(r, 'group', GROUP); });
  S.getCSV('data/ablation_blocks.csv').then(r => { document.getElementById('abl-blocks').innerHTML = ablTable(r, 'block', GROUP); });
  S.getCSV('data/matchup_ablation.csv').then(r => { document.getElementById('abl-matchup').innerHTML = ablTable(r, 'dropped', null); });
})();
