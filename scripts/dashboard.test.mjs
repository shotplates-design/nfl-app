import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboard, dashboardView, weekOf } from '../lib/dashboard.mjs';

const players = [
  { slug: 'alpha', name: 'Alpha Receiver', team: 'sea', cat: 'receiving', games: [
    { date: 'Sun 9/13', cat: 'receiving', primYds: 10, rec: 1 },
    { date: 'Sun 9/20', cat: 'receiving', primYds: 80, rec: 6 },
    { date: 'Sun 9/27', cat: 'receiving', primYds: 90, rec: 7 },
    { date: 'Sun 10/4', cat: 'receiving', primYds: 40, rec: 3 },
    { date: 'Sun 10/11', cat: 'receiving', primYds: 100, rec: 8 },
  ] },
  { slug: 'beta', name: 'Beta Receiver', team: 'den', cat: 'receiving', games: [
    { date: 'Sun 9/13', cat: 'receiving', primYds: 60, rec: 4 },
    { date: 'Sun 9/20', cat: 'receiving', primYds: 60, rec: 4 },
    { date: 'Sun 9/27', cat: 'receiving', primYds: 60, rec: 4 },
    { date: 'Sun 10/4', cat: 'receiving', primYds: 60, rec: 4 },
    { date: 'Sun 10/11', cat: 'receiving', primYds: 20, rec: 1 },
  ] },
  { slug: 'qb', name: 'Casey Quarterback', team: 'sea', cat: 'passing', games: [
    { date: 'Sun 9/13', cat: 'passing', passYds: 280, passTd: 2, primYds: 10 },
    { date: 'Sun 9/20', cat: 'passing', passYds: 240, passTd: 1, primYds: 4 },
    { date: 'Sun 9/27', cat: 'passing', passYds: 200, passTd: 1, primYds: 8 },
    { date: 'Sun 10/4', cat: 'passing', passYds: 260, passTd: 3, primYds: 12 },
    { date: 'Sun 10/11', cat: 'passing', passYds: 190, passTd: 0, primYds: 2 },
  ] },
];
const hot = [{
  slug: 'alpha', name: 'Alpha Receiver', team: 'sea', group: 'receiving', field: 'primYds', thr: 50, label: '50+ Rec Yds',
  streak: 2, hits: 3, games: 5, strip: [
    { d: 'Sun 9/13' }, { d: 'Sun 9/20' }, { d: 'Sun 9/27' }, { d: 'Sun 10/4' }, { d: 'Sun 10/11' },
  ],
}];
const desk = {
  week: 6,
  injuries: [{
    team: 'DEN', player: 'Pat Surtain II', position: 'CB', status: 'Out', game: 'SEA@DEN',
    coverage_role: 'CB1 and three-time All-Pro; normally takes the opponent\'s top outside receiver.',
    exploited_by: [{ player: 'Alpha Receiver', team: 'SEA', why: 'NFL leader in receiving yards.' }],
  }],
};
const week = { week: 6, games: [{ awayCode: 'sea', homeCode: 'den', slug: 'seahawks-at-broncos-2026-week-6' }] };
const legs = [
  { player: 'Alpha Receiver', market: 'player_reception_yds', side: 'Over', point: 74.5, price: -115 },
  { player: 'Alpha Receiver', market: 'player_reception_yds', side: 'Over', point: 74.5, price: 140 },
  { player: 'Beta Receiver', market: 'player_reception_yds', side: 'Under', point: 40.5, price: -110 },
  { player: 'Nobody', market: 'player_reception_yds', side: 'Over', point: 50.5, price: -110 },
];

test('weekOf maps the 2026 game-log dates', () => {
  assert.equal(weekOf('Wed 9/9'), 1);
  assert.equal(weekOf('Sun 9/13'), 1);
  assert.equal(weekOf('Mon 9/14'), 1);
  assert.equal(weekOf('Sun 9/20'), 2);
  assert.equal(weekOf('Sun 9/27'), 3);
  assert.equal(weekOf('Sun 10/4'), 4);
  assert.equal(weekOf('Mon 10/12'), 5);
  assert.equal(weekOf('Thu 10/15'), 6);
  assert.equal(weekOf(''), null);
});

test('filters move hit rates, trends, streaks, injuries, and odds together', () => {
  const model = buildDashboard({ players, hot, desk, week, legs });
  const all = dashboardView(model, {});
  assert.equal(all.kpis.best.slug, 'beta');
  assert.equal(all.kpis.best.hits, 4);
  assert.equal(all.kpis.up, 1);
  assert.equal(all.kpis.upName, 'Alpha Receiver');
  assert.equal(all.kpis.downName, 'Beta Receiver');
  assert.equal(all.kpis.streaks, 1);
  assert.equal(all.injuries.length, 1);
  assert.equal(all.injuries[0].href, '/injuries#injury-den-pat-surtain-ii');
  assert.equal(all.injuries[0].matchup, 'seahawks-at-broncos-2026-week-6');
  assert.equal(all.injuries[0].exploited[0].slug, 'alpha');
  assert.ok(all.injuries[0].exploited[0].why.includes('NFL leader'));
  assert.equal(all.scatter.length, 1);
  assert.equal(all.scatter[0].slug, 'alpha');
  assert.equal(all.scatter[0].line, 74.5);
  assert.equal(all.scatter[0].price, -115);
  assert.equal(all.scatter[0].hits, 3);

  const sea = dashboardView(model, { team: 'sea' });
  assert.ok(sea.bars.every(b => b.team === 'SEA'));
  assert.equal(sea.kpis.streaks, 1);
  assert.equal(sea.injuries.length, 1);

  const week5 = dashboardView(model, { week: '5', stat: 'recYds' });
  assert.equal(week5.bars.find(b => b.slug === 'alpha').rate, 100);
  assert.equal(week5.bars.find(b => b.slug === 'beta').rate, 0);
  assert.equal(week5.injuryHidden, true);
  assert.equal(week5.injuries.length, 0);

  const qb = dashboardView(model, { pos: 'QB', stat: 'passYds' });
  assert.equal(qb.bars.length, 1);
  assert.equal(qb.bars[0].slug, 'qb');
  assert.equal(qb.kpis.streaks, 0);
  assert.equal(qb.heat.positions.join(), 'QB');
});

test('the live season model names Jaxon Smith-Njigba and the Surtain injury', async () => {
  const { players: roster, allStreaks } = await import('../lib/data.ts');
  const { loadInjuryDesk } = await import('../lib/injuryAnalysis.ts');
  const { currentWeek } = await import('../lib/matchups.ts');
  const model = buildDashboard({ players: roster, hot: allStreaks().hot, desk: loadInjuryDesk(), week: currentWeek(), legs: [] });
  const view = dashboardView(model, { team: 'sea', pos: 'WR/TE', stat: 'recYds' });
  const jsn = view.bars.find(b => b.slug === 'jaxon-smith-njigba');
  assert.ok(jsn, 'JSN is on the Seahawks receiving board');
  assert.equal(jsn.hits, jsn.games);
  assert.ok(view.lines.some(l => l.slug === 'jaxon-smith-njigba'));
  const injuries = dashboardView(model, { week: '6' }).injuries;
  const surtain = injuries.find(i => i.player === 'Pat Surtain II');
  assert.ok(surtain);
  assert.equal(surtain.href, '/injuries#injury-den-pat-surtain-ii');
  assert.ok(surtain.exploited.some(e => e.slug === 'jaxon-smith-njigba'));
  assert.equal(model.odds.length, 0);
});
