import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { injuryBlurb, injuryId, samePlayer } from '../lib/injuryWhy.mjs';

const desk = JSON.parse(readFileSync(new URL('../data/week-6-injury-analysis.json', import.meta.url), 'utf8'));
const gazette = desk.injuries[0].expert_takes[0].quote_or_paraphrase;
const exploitedWhy = desk.injuries[0].exploited_by[0].why;
const spotlight = desk.matchup_spotlights.find(s => /JSN/.test(s.title));

test('JSN gets the Surtain shadow-corner line, the exact quote, and the injuries anchor', () => {
  const b = injuryBlurb(desk, { name: 'Jaxon Smith-Njigba', team: 'SEA' });
  assert.ok(b);
  assert.equal(b.note.text, 'DEN CB Pat Surtain II out (shadow corner) — JSN draws softer coverage');
  assert.equal(b.note.href, '/injuries#injury-den-pat-surtain-ii');
  assert.equal(b.note.href, `/injuries#${injuryId('DEN', 'Pat Surtain II')}`);
  assert.equal(injuryBlurb(desk, { name: 'Jaxon Smith-Njigba', team: 'sea' }).note.text, b.note.text);
  assert.ok(b.clause.includes(exploitedWhy), 'exploited_by why is included in full');
  assert.ok(b.clause.includes(`Denver Gazette: “${gazette}”`), 'expert quote is stored unsliced');
  assert.equal(gazette, "Broncos will try to defend JSN on national TV 'with a makeshift secondary.'");
  assert.ok(b.clause.includes(spotlight.body.split(/(?<=\.)\s/)[0]));
  assert.ok(b.clause.includes('CB1 and three-time All-Pro'));
  assert.ok(!b.clause.includes('…') && !b.clause.includes('...'));
});

test('middle coverage and teammate absences use the matching short line', () => {
  const barner = injuryBlurb(desk, { name: 'AJ Barner', team: 'SEA' });
  assert.equal(barner.note.text, 'DEN S Talanoa Hufanga out (middle coverage) — Barner draws softer coverage');
  assert.equal(barner.note.href, '/injuries#injury-den-talanoa-hufanga');
  assert.ok(barner.clause.includes(desk.injuries[1].exploited_by[0].why));

  const wilson = injuryBlurb(desk, { name: 'Emanuel Wilson', team: 'SEA' });
  assert.equal(wilson.note.text, 'SEA RB Zach Charbonnet out — Wilson benefits');
  assert.equal(wilson.note.href, '/injuries#injury-sea-zach-charbonnet');
  assert.ok(!/softer coverage/.test(wilson.note.text));
  assert.ok(wilson.clause.includes('Workhorse role'));

  const kupp = injuryBlurb(desk, { name: 'Cooper Kupp', team: 'SEA' });
  assert.equal(kupp.note.text, 'DEN CB Pat Surtain II out (shadow corner) — Kupp draws softer coverage');

  const dobbins = injuryBlurb(desk, { name: 'J.K. Dobbins', team: 'DEN' });
  assert.equal(dobbins.note.text, 'SEA LB Drake Thomas out (middle coverage) — Dobbins benefits');
  assert.equal(dobbins.note.href, '/injuries#injury-sea-drake-thomas');
  assert.ok(dobbins.clause.includes('softer vs run'));
});

test('name matching does not attach group labels or the wrong team', () => {
  assert.equal(injuryBlurb(desk, { name: 'Jaxon Smith-Njigba', team: 'DEN' }), null);
  assert.equal(injuryBlurb(desk, { name: 'Somebody Else', team: 'SEA' }), null);
  assert.equal(injuryBlurb(null, { name: 'Jaxon Smith-Njigba', team: 'SEA' }), null);
  assert.equal(samePlayer('SEA tight ends / slot receivers', 'AJ Barner'), false);
  assert.equal(samePlayer('Seattle outside WRs', 'Jaxon Smith-Njigba'), false);
  assert.equal(samePlayer('Pat Surtain II', 'Pat Surtain'), true);
});

test('an injured player himself gets the head line only', () => {
  const self = injuryBlurb(desk, { name: 'Pat Surtain II', team: 'DEN' });
  assert.equal(self.note.text, 'DEN CB Pat Surtain II out (shadow corner)');
  assert.equal(self.note.href, '/injuries#injury-den-pat-surtain-ii');
});

test('Best Props and Sleepers rows carry the injury clause and the anchor', async () => {
  const { candidates, sleepers } = await import('../lib/bestprops.ts');
  const rows = candidates();
  const jsn = rows.find(r => r.name === 'Jaxon Smith-Njigba');
  assert.ok(jsn, 'JSN is a Week 6 candidate');
  assert.equal(jsn.injuryNote.text, 'DEN CB Pat Surtain II out (shadow corner) — JSN draws softer coverage');
  assert.equal(jsn.injuryNote.href, '/injuries#injury-den-pat-surtain-ii');
  assert.ok(jsn.why.includes(exploitedWhy));
  assert.ok(jsn.why.includes(gazette));
  assert.ok(jsn.why.endsWith('.'));

  const quiet = rows.find(r => !r.injuryNote);
  assert.ok(quiet, 'players the desk does not name keep a null injury note');
  assert.equal(quiet.injuryNote, null);

  const { pick, all } = sleepers(15);
  const noted = all.filter(r => r.injuryNote);
  assert.ok(noted.length > 0, 'at least one sleeper is tied to an injury');
  for (const r of noted) {
    assert.match(r.injuryNote.href, /^\/injuries#injury-[a-z0-9-]+$/);
    assert.ok(r.why.includes(r.injuryNote.text.split(' — ')[0].replace(/ \([^)]+\)$/, '')) || r.why.length > 10);
    const blur = injuryBlurb(desk, { name: r.name, team: r.team });
    assert.equal(r.injuryNote.href, blur.note.href);
    assert.ok(r.why.includes(blur.clause));
  }
  assert.ok(pick.every(r => r.why && typeof r.injuryNote !== 'undefined'));
});

test('the week 6 file adds the Houston outs, the Marks split, the London spotlight, and stale TNF picks', async () => {
  const { loadInjuryDesk, formatWithWithout } = await import('../lib/injuryAnalysis.ts');
  const loaded = loadInjuryDesk();
  const hou = loaded.injuries.filter(i => i.team === 'HOU');
  assert.deepEqual(hou.map(i => [i.player, i.status]), [
    ['David Montgomery', 'Out'],
    ['Tank Dell', 'Out'],
    ['Jalen Pitre', 'Out'],
  ]);
  const marks = hou[0].beneficiaries.find(b => b.player === 'Woody Marks');
  assert.ok(marks.key_stat_with_without.includes('With Montgomery: 4 games, 7 carries/g, 21.8 rush yds/g'));
  assert.ok(marks.key_stat_with_without.includes('Without Montgomery: 1 game, 15 carries, 62 rush yds, 4 targets, 23 rec yds'));
  assert.ok(marks.key_stat_with_without.includes('Week 5 vs TEN'));
  assert.equal(marks.key_stat_with_without.includes('[object Object]'), false);
  assert.ok(hou[0].matchup_note.includes('lowest yards after contact'));
  const london = loaded.matchup_spotlights.find(s => s.title === "Woody's World Tour: London Edition");
  assert.ok(london);
  assert.equal(london.game, 'HOU@JAX');
  assert.ok(london.body.includes('Wembley'));
  assert.ok(loaded.kenzie_picks.length > 0);
  assert.ok(loaded.kenzie_picks.every(p => p.status.startsWith('stale:')));
  assert.equal(formatWithWithout('plain text'), 'plain text');
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
