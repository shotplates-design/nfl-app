// Short injury context for Best Props and Sleepers "why" lines from ESPN status data.
// Empty-safe: returns null when the desk has no matching status row.
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
export function samePlayer(a, b) {
  const x = nameKey(a), y = nameKey(b);
  return !!x && x.length >= 4 && x === y;
}
export function injuryId(team, player) {
  const slug = `${team}-${player}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `injury-${slug}`;
}
function statusWord(status) {
  const s = String(status || '').trim();
  if (!s) return 'listed';
  return /^out\b/i.test(s) ? 'out' : s;
}
const teamOk = (listed, team) => !listed || !team || String(listed).toUpperCase() === String(team).toUpperCase();

/** ESPN-status blurb only — no curated expert takes, exploited_by, or spotlights. */
export function injuryBlurb(desk, { name, team } = {}) {
  if (!desk || !name) return null;
  const self = (desk.injuries || []).find(
    (item) => samePlayer(item.player, name) && teamOk(item.team, team) && (item.status || item.injury || item.practice_latest),
  );
  if (!self) return null;
  const pos = self.position ? `${self.position} ` : '';
  const injuryBit = self.injury ? ` (${self.injury})` : '';
  const text = `${self.team} ${pos}${self.player} ${statusWord(self.status)}${injuryBit}`.replace(/\s+/g, ' ').trim();
  return {
    clause: text,
    note: { text, href: `/injuries#${self.id || injuryId(self.team, self.player)}` },
  };
}

/** Build a note from a matchup's conditions injury list (ESPN rows). Empty → null. */
export function espnStatusNote(injuries, { name, team } = {}) {
  if (!name || !Array.isArray(injuries) || !injuries.length) return null;
  const row = injuries.find((i) => samePlayer(i.player || i.name, name) && teamOk(i.team, team));
  if (!row || !(row.status || row.injury || row.practice_latest)) return null;
  const teamCode = String(row.team || team || '').toUpperCase();
  const pos = row.position ? `${row.position} ` : '';
  const injuryBit = row.injury ? ` (${row.injury})` : '';
  const text = `${teamCode} ${pos}${row.player} ${statusWord(row.status)}${injuryBit}`.replace(/\s+/g, ' ').trim();
  return { text, href: `/injuries#${injuryId(teamCode, row.player)}` };
}
