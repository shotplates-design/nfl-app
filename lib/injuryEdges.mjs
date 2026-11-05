// Automatic Injury edges from ESPN Out/Doubtful rows + season game logs.
// Teammates who stand to gain (backup RB / next WR-TE / backup QB) only when a
// prop already clears the hit-rate floor. No targets, tackles, odds, or bet UI.
import { players } from './data.ts';
import { buildPgames, STATS } from './props.mjs';
import { injuryId, samePlayer } from './injuryWhy.mjs';

export const EDGE_HIT_FLOOR = 0.6;
export const EDGE_MIN_GAMES = 3;
/** Props allowed on Injury edges — never targets or tackles. */
export const EDGE_PROPS = {
  QB: ['passYds', 'passTd', 'rushYds'],
  RB: ['rushYds', 'recYds', 'rec'],
  'WR/TE': ['recYds', 'rec'],
};
const MIN_LINE = (role, k) => (k === 'rec' ? (role === 'WR/TE' ? 5 : 3) : k === 'passTd' ? 2 : /Yds$/.test(k) ? 10 : 1);
const STEP = (k) => (/Yds$/.test(k) ? 5 : 1);
const USAGE_STAT = { QB: 'passYds', RB: 'rushYds', 'WR/TE': 'recYds' };

const OUT_STATUSES = /^(out|doubtful)\b/i;

function statusWord(status) {
  const s = String(status || '').trim();
  if (/^out\b/i.test(s)) return 'out';
  if (/^doubtful\b/i.test(s)) return 'doubtful';
  return s.toLowerCase();
}

function skillGroup(position, role) {
  const p = String(position || '').toUpperCase();
  if (role === 'QB' || p === 'QB') return 'QB';
  if (role === 'RB' || p === 'RB' || p === 'FB') return 'RB';
  if (role === 'WR/TE' || p === 'WR' || p === 'TE' || p === 'WR/TE') return 'WR/TE';
  return null;
}

function teamCode(code) {
  return String(code || '').trim().toLowerCase();
}

function abbrUpper(code) {
  return String(code || '').trim().toUpperCase();
}

function pickLine(vals, k) {
  const s = [...vals].sort((a, b) => a - b);
  const st = STEP(k);
  const idx = Math.floor(s.length * (1 - EDGE_HIT_FLOOR) + 1e-9);
  return Math.floor(s[Math.min(s.length - 1, Math.max(0, idx))] / st) * st;
}

function usageAvg(games, stat) {
  const vals = games.filter((g) => stat in g[2]).map((g) => g[2][stat]);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function bestEdgeProp(role, games) {
  const keys = EDGE_PROPS[role];
  if (!keys) return null;
  let best = null;
  for (const k of keys) {
    const gs = games.filter((g) => k in g[2]);
    if (gs.length < EDGE_MIN_GAMES) continue;
    const vals = gs.map((g) => g[2][k]);
    const line = pickLine(vals, k);
    if (line < MIN_LINE(role, k)) continue;
    const hits = vals.filter((v) => v >= line).length;
    const rate = hits / gs.length;
    if (rate + 1e-12 < EDGE_HIT_FLOOR) continue;
    const score = rate * 100 + line / 100;
    if (!best || score > best.score) {
      best = { stat: k, line, hits, games: gs.length, rate, label: STATS[k][0], score };
    }
  }
  return best;
}

/** Build Injury edges from a conditions-style desk (or analysis desk with status rows). */
export function buildInjuryEdges(desk, pgames = null) {
  if (!desk || !Array.isArray(desk.injuries) || !desk.injuries.length) return [];
  const pg = pgames || buildPgames(players);
  const byTeam = new Map();
  for (const row of pg.p) {
    const team = teamCode(row[2]);
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team).push(row);
  }

  const edges = [];
  const seen = new Set();
  for (const item of desk.injuries) {
    if (!item || !OUT_STATUSES.test(item.status || '')) continue;
    const group = skillGroup(item.position, null);
    if (!group) continue;
    const team = teamCode(item.team);
    if (!team) continue;
    const roster = (byTeam.get(team) || []).filter((row) => {
      if (row[3] !== group) return false;
      if (samePlayer(row[1], item.player)) return false;
      return true;
    });
    const usageKey = USAGE_STAT[group];
    roster.sort((a, b) => usageAvg(b[4], usageKey) - usageAvg(a[4], usageKey));
    for (const [slug, name, tcode, role, games] of roster.slice(0, 3)) {
      const prop = bestEdgeProp(role, games);
      if (!prop) continue;
      const key = `${slug}|${prop.stat}|${item.player}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const shortStat = prop.stat === 'rec' ? 'rec' : prop.stat === 'passTd' ? 'pass TD' : prop.label.replace(/ing yds/i, 'yds').replace(/Passing yds/i, 'pass yds').replace(/Rushing yds/i, 'rush yds').replace(/Receiving yds/i, 'rec yds');
      const reason = `${item.player} ${statusWord(item.status)}, ${name} ${prop.line}+ ${shortStat} ${prop.hits}/${prop.games}`;
      edges.push({
        injured: item.player,
        injuredTeam: abbrUpper(item.team),
        injuredPosition: item.position || '',
        injuredStatus: item.status,
        injuredHref: `/injuries#${item.id || injuryId(item.team, item.player)}`,
        player: name,
        team: abbrUpper(tcode),
        role,
        slug,
        stat: prop.stat,
        line: prop.line,
        hits: prop.hits,
        games: prop.games,
        rate: prop.rate,
        label: `${prop.line}+ ${prop.label}`,
        reason,
      });
      break; // one beneficiary prop per injured player
    }
  }
  edges.sort((a, b) => b.rate - a.rate || b.hits - a.hits || a.player.localeCompare(b.player));
  return edges;
}
