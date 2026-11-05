import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EDGE_HIT_FLOOR, EDGE_PROPS, buildInjuryEdges } from '../lib/injuryEdges.mjs';
import { loadInjuryDesk } from '../lib/injuryAnalysis.ts';

test('EDGE_PROPS never lists targets or tackles', () => {
  const keys = Object.values(EDGE_PROPS).flat();
  assert.ok(keys.length > 0);
  assert.ok(!keys.includes('targets') && !keys.includes('tgts'));
  assert.ok(!keys.includes('tackles') && !keys.includes('solo'));
  assert.equal(EDGE_HIT_FLOOR, 0.6);
});

test('live week desk builds Injury edges from Out/Doubtful skill players with 60% floor', () => {
  const desk = loadInjuryDesk();
  assert.ok(desk);
  const edges = buildInjuryEdges(desk);
  // Real week-9 data should yield at least Montgomery → Marks style edges when logs clear the floor.
  assert.ok(Array.isArray(edges));
  for (const e of edges) {
    assert.ok(e.rate + 1e-12 >= EDGE_HIT_FLOOR, `${e.player} rate ${e.rate}`);
    assert.ok(e.hits / e.games + 1e-12 >= EDGE_HIT_FLOOR);
    assert.ok(!/target|tackle|odds|bet\b/i.test(e.reason));
    assert.ok(!/target|tackle/i.test(e.stat));
    assert.match(e.reason, /out|doubtful/i);
    assert.match(e.injuredHref, /^\/injuries#injury-/);
    assert.ok(e.label.includes('+'));
  }
  const mont = edges.find((e) => /montgomery/i.test(e.injured));
  if (mont) {
    assert.match(mont.player, /Marks|Jordan|Dell|Noel|Collins|Schultz/i);
    assert.match(mont.reason, /Montgomery out/i);
  }
});

test('empty desk and Questionable-only desks hide Injury edges', () => {
  assert.deepEqual(buildInjuryEdges(null), []);
  assert.deepEqual(buildInjuryEdges({ injuries: [] }), []);
  assert.deepEqual(
    buildInjuryEdges({
      injuries: [{ team: 'HOU', player: 'Nico Collins', position: 'WR', status: 'Questionable', injury: 'Ankle' }],
    }),
    [],
  );
});

test('hit-rate floor rejects props below 60%', () => {
  const desk = {
    injuries: [{ id: 'injury-x', team: 'HOU', player: 'David Montgomery', position: 'RB', status: 'Out' }],
  };
  // Synthetic teammate with a weak reception rate — force via stub pgames.
  const pgames = {
    p: [
      [
        'woody-marks',
        'Woody Marks',
        'hou',
        'RB',
        [
          ['a', '@A', { rushYds: 5, rec: 0 }],
          ['b', '@B', { rushYds: 5, rec: 0 }],
          ['c', '@C', { rushYds: 5, rec: 0 }],
          ['d', '@D', { rushYds: 5, rec: 1 }],
          ['e', '@E', { rushYds: 5, rec: 0 }],
        ],
      ],
    ],
  };
  // rushYds line floors at 10, so 5-yd samples never qualify; rec line for RB is 3 and rate is 1/5.
  assert.deepEqual(buildInjuryEdges(desk, pgames), []);
});

test('Injury desk UI replaces Kenzie picks with Injury edges and never says bets', () => {
  const ui = readFileSync(new URL('../components/InjuryDesk.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/injuries/page.tsx', import.meta.url), 'utf8');
  assert.match(ui, /Injury edges/);
  assert.match(ui, /buildInjuryEdges/);
  assert.doesNotMatch(ui, /Kenzie'?s Picks|kenzie_picks|PickCard/);
  assert.doesNotMatch(ui, /\bbets?\b/i);
  assert.doesNotMatch(ui, /Betting angle/i);
  assert.doesNotMatch(page, /Kenzie/);
  assert.match(page, /Injury Edges/i);
});
