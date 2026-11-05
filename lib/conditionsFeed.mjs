// Drop-in conditions files (data/week-N-conditions.json) must keep these keys.
// The matchup loader reads them. weather, with_without, and inactives stay present
// even when empty; practice_latest on injury rows remains optional.
export const FILE_KEYS = ['updated'];
export const GAME_KEYS = ['away', 'home', 'weather', 'injuries', 'with_without', 'inactives'];

export function missingFeedKeys(feed) {
  const missing = [];
  if (!feed || typeof feed !== 'object') return ['feed'];
  for (const key of FILE_KEYS) if (!(key in feed) || feed[key] == null || feed[key] === '') missing.push(key);
  const games = Array.isArray(feed.games) ? feed.games : [];
  if (!games.length) missing.push('games');
  games.forEach((game, i) => {
    for (const key of GAME_KEYS) if (!game || !(key in game)) missing.push(`games[${i}].${key}`);
  });
  return missing;
}

export function practiceLine(injury) {
  const latest = injury && injury.practice_latest;
  return latest ? `Practice: ${latest}` : '';
}

/** inactives is {TEAM: [names], source_urls?: string[]} or absent. */
export function inactiveGroups(block) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return [];
  return Object.entries(block).filter(([key, names]) => key !== 'source_urls' && Array.isArray(names) && names.length);
}

export function formatWithWithout(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatWithWithout).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    if (typeof value.takeaway === 'string' && value.takeaway) return value.takeaway;
    return Object.entries(value).map(([key, item]) => `${key}: ${formatWithWithout(item)}`).filter(part => !part.endsWith(': ')).join(' · ');
  }
  return String(value);
}
