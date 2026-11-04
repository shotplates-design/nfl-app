import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatWithWithout, inactiveGroups, missingFeedKeys, practiceLine } from '../lib/conditionsFeed.mjs';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

test('week 7 and 8 conditions keep the loader keys', () => {
  for (const name of ['week-7-conditions.json', 'week-8-conditions.json']) {
    const feed = load(name);
    assert.deepEqual(missingFeedKeys(feed), [], `${name} is missing loader keys`);
    assert.equal(typeof feed.updated, 'string');
    assert.ok(feed.games.length >= 13 && feed.games.length <= 16);
    for (const game of feed.games) {
      assert.equal(typeof game.away, 'string');
      assert.equal(typeof game.home, 'string');
      assert.equal(typeof game.weather, 'object');
      assert.ok(Array.isArray(game.injuries));
      assert.ok('with_without' in game);
    }
  }
});

test('a feed missing a loader key fails', () => {
  const feed = load('week-7-conditions.json');
  const broken = { ...feed, games: feed.games.map(game => ({ ...game })) };
  delete broken.games[0].with_without;
  assert.ok(missingFeedKeys(broken).some(key => key.endsWith('.with_without')));
  delete broken.updated;
  assert.ok(missingFeedKeys(broken).includes('updated'));
});

test('dropped inactives, notes, and practice_latest render without inventing a list', () => {
  const week7 = load('week-7-conditions.json');
  const week8 = load('week-8-conditions.json');
  const withList = week7.games.find(game => game.inactives);
  const dropped = week8.games.find(game => !('inactives' in game));
  assert.ok(withList);
  assert.ok(inactiveGroups(withList.inactives).length >= 1);
  assert.deepEqual(inactiveGroups(dropped && dropped.inactives), []);
  assert.deepEqual(inactiveGroups(undefined), []);
  const noted = week7.games.flatMap(game => game.injuries).find(row => row.note && row.practice_latest);
  assert.match(practiceLine(noted), /^Practice: /);
  assert.equal(practiceLine({ practice_latest: null }), '');
  assert.equal(practiceLine({}), '');
  const split = week7.games.find(game => Array.isArray(game.with_without) && game.with_without.length);
  const text = formatWithWithout(split.with_without);
  assert.ok(text.length > 0);
  assert.equal(text.includes('[object Object]'), false);
  assert.equal(formatWithWithout(undefined), '');
});
