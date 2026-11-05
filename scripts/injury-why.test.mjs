import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { espnStatusNote, injuryBlurb, injuryId, samePlayer } from '../lib/injuryWhy.mjs';

const desk = {
  week: 9,
  injuries: [
    {
      id: 'injury-hou-david-montgomery',
      team: 'HOU',
      player: 'David Montgomery',
      position: 'RB',
      status: 'Out',
      injury: 'Illness',
    },
    {
      id: 'injury-sea-sam-darnold',
      team: 'SEA',
      player: 'Sam Darnold',
      position: 'QB',
      status: 'Out',
      injury: 'Neck',
    },
    {
      id: 'injury-lac-brenen-thompson',
      team: 'LAC',
      player: 'Brenen Thompson',
      position: 'WR',
      status: 'Doubtful',
      injury: 'Undisclosed',
    },
  ],
};

test('ESPN status blurbs name the player and anchor without curated Kenzie prose', () => {
  const b = injuryBlurb(desk, { name: 'David Montgomery', team: 'HOU' });
  assert.ok(b);
  assert.equal(b.note.text, 'HOU RB David Montgomery out (Illness)');
  assert.equal(b.note.href, '/injuries#injury-hou-david-montgomery');
  assert.equal(b.clause, b.note.text);
  assert.equal(injuryBlurb(desk, { name: 'David Montgomery', team: 'hou' }).note.text, b.note.text);
  assert.doesNotMatch(b.clause, /Gazette|exploited|softer coverage|“/);
});

test('Doubtful and Out both render; empty notes stay null', () => {
  const d = injuryBlurb(desk, { name: 'Brenen Thompson', team: 'LAC' });
  assert.equal(d.note.text, 'LAC WR Brenen Thompson Doubtful (Undisclosed)');
  assert.equal(injuryBlurb(desk, { name: 'Somebody Else', team: 'SEA' }), null);
  assert.equal(injuryBlurb(null, { name: 'Sam Darnold', team: 'SEA' }), null);
  assert.equal(injuryBlurb({ injuries: [] }, { name: 'Sam Darnold', team: 'SEA' }), null);
  assert.equal(injuryBlurb(desk, { name: 'Sam Darnold', team: 'DEN' }), null);
  assert.equal(samePlayer('Pat Surtain II', 'Pat Surtain'), true);
  assert.equal(espnStatusNote([], { name: 'Sam Darnold', team: 'SEA' }), null);
  assert.equal(espnStatusNote(undefined, { name: 'Sam Darnold', team: 'SEA' }), null);
});

test('espnStatusNote reads matchup conditions rows the same way', () => {
  const note = espnStatusNote(
    [{ team: 'SEA', player: 'Sam Darnold', position: 'QB', status: 'Out', injury: 'Neck' }],
    { name: 'Sam Darnold', team: 'sea' },
  );
  assert.equal(note.text, 'SEA QB Sam Darnold out (Neck)');
  assert.equal(note.href, `/injuries#${injuryId('SEA', 'Sam Darnold')}`);
});

test('Best Props and Sleepers attach ESPN status notes when present and stay null otherwise', async () => {
  const { candidates, sleepers } = await import('../lib/bestprops.ts');
  const rows = candidates();
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.ok(r.why && typeof r.injuryNote !== 'undefined');
    assert.ok(!/Gazette|draws softer coverage|Kenzie/i.test(r.why));
    if (r.injuryNote) {
      assert.match(r.injuryNote.href, /^\/injuries#injury-[a-z0-9-]+$/);
      assert.ok(r.injuryNote.text);
      assert.ok(r.why.includes(r.injuryNote.text));
    }
  }
  const quiet = rows.find((r) => r.injuryNote === null);
  assert.ok(quiet, 'players without an ESPN status row keep a null injury note');

  const { pick, all } = sleepers(15);
  assert.ok(pick.every((r) => r.why && typeof r.injuryNote !== 'undefined'));
  for (const r of all.filter((x) => x.injuryNote)) {
    assert.match(r.injuryNote.href, /^\/injuries#injury-[a-z0-9-]+$/);
    assert.doesNotMatch(r.why, /Gazette|softer coverage/);
  }
});

test('loadInjuryDesk prefers the current week conditions feed over a stale analysis file', async () => {
  const { loadInjuryDesk } = await import('../lib/injuryAnalysis.ts');
  const { currentWeek } = await import('../lib/matchups.ts');
  const loaded = loadInjuryDesk();
  assert.ok(loaded);
  assert.equal(loaded.week, currentWeek().week);
  assert.ok(loaded.injuries.length > 0);
  // Week-9 ESPN desk has no curated beneficiaries / expert takes.
  assert.ok(loaded.injuries.every((i) => (i.exploited_by || []).length === 0));
  assert.equal(loaded.kenzie_picks.length, 0);
});

test('public gating still sends only the preview rows', () => {
  const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const welcome = readFileSync(new URL('../app/welcome/page.tsx', import.meta.url), 'utf8');
  const sleepersPage = readFileSync(new URL('../app/sleepers/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /const rows=mem\?all:all\.slice\(0,3\)/);
  assert.match(home, /rows\.slice\(0,3\)/);
  assert.match(welcome, /all\.slice\(0,3\)/);
  assert.match(welcome, /'injuryNote'/);
  assert.match(welcome, /why:'Locked\. Members see every ranked prop with the full reasoning\.'/);
  assert.doesNotMatch(welcome, /draws softer coverage/);
  assert.match(sleepersPage, /pick\.slice\(0,2\)/);
  assert.match(sleepersPage, /pick\.slice\(2\)/);
});
