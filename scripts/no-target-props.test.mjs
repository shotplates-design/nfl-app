import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GROUPS, bestHitProp, playerStreaks, topValueStreaks } from '../lib/streaks.mjs';
import { DEFAULT_Q, POPULAR, POS_STATS, STATS, buildPgames, normalizeQuery } from '../lib/props.mjs';
import { STATS_META } from '../lib/dashboard.mjs';

const mentionsTargets = (s) => /targets?/i.test(String(s || ''));
const games = [
  { date: 'Sun 9/13', opp: 'vsDEN', cat: 'receiving', primYds: 10, rec: 1, tgts: 12, primTd: 0 },
  { date: 'Sun 9/20', opp: '@LAR', cat: 'receiving', primYds: 12, rec: 1, tgts: 11, primTd: 0 },
  { date: 'Sun 9/27', opp: 'vsSF', cat: 'receiving', primYds: 8, rec: 1, tgts: 10, primTd: 0 },
  { date: 'Sun 10/4', opp: '@ARI', cat: 'receiving', primYds: 9, rec: 1, tgts: 13, primTd: 0 },
  { date: 'Sun 10/11', opp: 'vsLAR', cat: 'receiving', primYds: 11, rec: 1, tgts: 12, primTd: 0 },
];
const guy = { slug: 'target-guy', name: 'Target Guy', team: 'sea', cat: 'receiving', games };

test('a receiver who only clears targets is not given a prop or a top streak', () => {
  assert.equal(bestHitProp(guy, [guy]), null);
  assert.equal(topValueStreaks([guy], { limit: 10 }).length, 0);
  for (const r of playerStreaks(guy)) {
    assert.notEqual(r.field, 'tgts');
    assert.equal(mentionsTargets(r.label), false);
  }
});

test('streak builder, dashboard charts, and SEO queries have no targets option', () => {
  assert.equal(STATS.tgts, undefined);
  for (const [key, row] of Object.entries(STATS)) {
    assert.notEqual(key, 'tgts');
    assert.notEqual(row[1], 'tgts');
    assert.equal(mentionsTargets(row[0]), false);
  }
  for (const keys of Object.values(POS_STATS)) assert.equal(keys.includes('tgts'), false);
  for (const pos of ['WR/TE', 'RB', 'any']) {
    const q = normalizeQuery({ ...DEFAULT_Q, pos, stat: 'tgts', line: 8 });
    assert.notEqual(q.stat, 'tgts');
    assert.equal(mentionsTargets(STATS[q.stat][0]), false);
  }
  for (const p of POPULAR) {
    assert.notEqual(p.q.stat, 'tgts');
    assert.equal(mentionsTargets(p.slug), false);
    assert.equal(mentionsTargets(p.title), false);
  }
  for (const def of Object.values(GROUPS)) for (const m of def.markets) {
    assert.notEqual(m[0], 'tgts');
    assert.equal(mentionsTargets(m[2]), false);
  }
  assert.equal(STATS_META.tgts, undefined);
  for (const meta of Object.values(STATS_META)) {
    assert.notEqual(meta.field, 'tgts');
    assert.equal(mentionsTargets(meta.label), false);
  }
  const share = readFileSync(new URL('../components/shareImage.ts', import.meta.url), 'utf8');
  const builder = readFileSync(new URL('../components/PropBuilder.tsx', import.meta.url), 'utf8');
  assert.equal(mentionsTargets(share), false);
  assert.equal(builder.includes('tgts'), false);
});

test('prop pages drop the targets column and game logs keep it', async () => {
  const { CAT_STATS, propPageStats } = await import('../lib/data.ts');
  assert.ok(CAT_STATS.receiving.some(s => s[0] === 'tgts' && s[1] === 'Targets'));
  assert.ok(CAT_STATS.rushing.some(s => s[0] === 'tgts' && s[1] === 'Targets'));
  const shown = propPageStats('receiving').map(s => s[0]);
  assert.deepEqual(shown, ['primYds', 'rec', 'primTd', 'lng']);
  for (const cat of Object.keys(CAT_STATS)) assert.equal(propPageStats(cat).some(s => s[0] === 'tgts'), false);
});

test('live best props, top streaks, sleepers, and the line explorer skip targets', async () => {
  const { players, streaksFor } = await import('../lib/data.ts');
  const { candidates, sleepers, SLEEPER_NOTE } = await import('../lib/bestprops.ts');
  assert.equal(mentionsTargets(SLEEPER_NOTE), false);
  for (const p of players) {
    const bp = bestHitProp(p, players);
    if (bp) {
      assert.notEqual(bp.key, 'tgts');
      assert.equal(mentionsTargets(bp.text), false);
      assert.equal(mentionsTargets(bp.title), false);
    }
    for (const r of streaksFor(p)) {
      assert.notEqual(r.field, 'tgts');
      assert.equal(mentionsTargets(r.label), false);
    }
  }
  for (const r of topValueStreaks(players, { limit: 5000 })) {
    assert.notEqual(r.field, 'tgts');
    assert.equal(mentionsTargets(r.label), false);
  }
  for (const r of candidates()) {
    assert.notEqual(r.stat, 'tgts');
    assert.equal(mentionsTargets(`${r.prop} ${r.label}`), false);
  }
  for (const r of sleepers(50).all) {
    assert.notEqual(r.stat, 'tgts');
    assert.equal(mentionsTargets(`${r.prop} ${r.label}`), false);
  }
  for (const row of buildPgames(players).p) for (const g of row[4]) assert.equal(Object.hasOwn(g[2], 'tgts'), false);
});
