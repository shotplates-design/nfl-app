// Pure sportsbook-line helpers. No API key, no Redis. Safe to unit-check.
import { STATS } from './props.mjs';
import { samePlayer, type StoredLeg } from './betslip';

export const CREDIT_FLOOR = 40;
export const PREKICK_MS = 2 * 60 * 60 * 1000;

/** Every NFL player-prop market The Odds API documents. One credit per market per game. */
export const PLAYER_MARKETS = [
  'player_pass_yds','player_pass_tds','player_pass_completions','player_pass_attempts','player_pass_interceptions',
  'player_pass_longest_completion','player_pass_rush_yds','player_pass_rush_reception_tds','player_pass_rush_reception_yds',
  'player_pass_yds_q1','player_rush_yds','player_rush_attempts','player_rush_longest','player_rush_tds',
  'player_rush_reception_tds','player_rush_reception_yds','player_reception_yds','player_receptions',
  'player_reception_longest','player_reception_tds','player_anytime_td','player_1st_td','player_last_td',
  'player_tds_over','player_tds','player_field_goals','player_kicking_points','player_pats',
  'player_tackles_assists','player_solo_tackles','player_assists','player_sacks','player_defensive_interceptions',
] as const;

type Meta = { label: string; stat?: string; yes?: boolean; noHit?: boolean; agg?: string };
export const MARKET_META: Record<string, Meta> = {
  player_pass_yds: { label: 'Pass Yds', stat: 'passYds' },
  player_pass_tds: { label: 'Pass TD', stat: 'passTd' },
  player_pass_completions: { label: 'Completions', stat: 'cmp' },
  player_pass_attempts: { label: 'Pass Att', stat: 'passAtt' },
  player_pass_interceptions: { label: 'Pass INT', stat: 'int' },
  player_pass_longest_completion: { label: 'Longest Comp', agg: 'lngPass' },
  player_pass_rush_yds: { label: 'Pass+Rush Yds', agg: 'passRushYds' },
  player_pass_rush_reception_tds: { label: 'Pass+Rush+Rec TD', agg: 'prrTd' },
  player_pass_rush_reception_yds: { label: 'Pass+Rush+Rec Yds', agg: 'prrYds' },
  player_pass_yds_q1: { label: 'Pass Yds Q1', noHit: true },
  player_rush_yds: { label: 'Rush Yds', stat: 'rushYds' },
  player_rush_attempts: { label: 'Rush Att', stat: 'car' },
  player_rush_longest: { label: 'Long Rush', agg: 'lngRush' },
  player_rush_tds: { label: 'Rush TD', stat: 'rushTd' },
  player_rush_reception_tds: { label: 'Rush+Rec TD', agg: 'rushRecTd' },
  player_rush_reception_yds: { label: 'Rush+Rec Yds', agg: 'rushRecYds' },
  player_reception_yds: { label: 'Rec Yds', stat: 'recYds' },
  player_receptions: { label: 'Rec', stat: 'rec' },
  player_reception_longest: { label: 'Long Rec', agg: 'lngRec' },
  player_reception_tds: { label: 'Rec TD', stat: 'recTd' },
  player_anytime_td: { label: 'Anytime TD', stat: 'rrTd', yes: true },
  player_1st_td: { label: '1st TD', yes: true, noHit: true },
  player_last_td: { label: 'Last TD', yes: true, noHit: true },
  player_tds_over: { label: 'TDs', stat: 'rrTd' },
  player_tds: { label: 'TD', stat: 'rrTd', yes: true },
  player_field_goals: { label: 'FG', stat: 'fgm' },
  player_kicking_points: { label: 'K Pts', stat: 'kPts' },
  player_pats: { label: 'XP', stat: 'xpm' },
  player_tackles_assists: { label: 'Tackles', stat: 'tackles' },
  player_solo_tackles: { label: 'Solo Tkl', stat: 'solo' },
  player_assists: { label: 'Assists', noHit: true },
  player_sacks: { label: 'Sacks', stat: 'sacks' },
  player_defensive_interceptions: { label: 'DEF INT', stat: 'defInt' },
};

export const CAT_MARKET: Record<string, string> = {
  passing: 'player_pass_yds', rushing: 'player_rush_yds', receiving: 'player_reception_yds',
  defense: 'player_tackles_assists', kicking: 'player_kicking_points',
};

/** First pull when a game has no cache. One refresh, only inside the two hours before kickoff. Stop when remaining credits are under the floor. */
export function pullDecision(cached: { preKick?: boolean } | null, commence: string, now: number, remaining: number | null): 'pull' | 'refresh' | 'serve' | 'skip' {
  const kick = Date.parse(commence);
  const before = Number.isFinite(kick) ? kick - now : Infinity;
  const inPre = before > 0 && before <= PREKICK_MS;
  const blocked = remaining != null && remaining < CREDIT_FLOOR;
  if (!cached) return blocked ? 'skip' : 'pull';
  if (inPre && !cached.preKick) return blocked ? 'serve' : 'refresh';
  return 'serve';
}

const trim = (n: number) => String(Math.round(n * 1000) / 1000);

export function formatChip(label: string, point: number | null, price: number | undefined, side: string, hit: { hits: number; games: number } | null) {
  const head = point == null ? label : `${label} ${trim(point)}`;
  const bits = [head];
  if (typeof price === 'number' && Number.isFinite(price)) {
    const n = `${price > 0 ? '+' : ''}${price}`;
    bits.push(side === 'Over' ? `o${n}` : n);
  }
  if (hit && hit.games) bits.push(`hit ${hit.hits}/${hit.games}`);
  return bits.join(' · ');
}

function byDate(games: any[], pick: (g: any) => number | null, how: 'sum' | 'max' = 'sum') {
  const order: string[] = []; const acc = new Map<string, number>();
  for (const g of games || []) {
    const v = pick(g);
    if (v == null || !Number.isFinite(v)) continue;
    const id = String(g.k ?? g.date);
    if (!acc.has(id)) { order.push(id); acc.set(id, v); }
    else acc.set(id, how === 'max' ? Math.max(acc.get(id)!, v) : acc.get(id)! + v);
  }
  return order.map(id => acc.get(id)!);
}
function statValues(games: any[], stat: string) {
  const spec = (STATS as any)[stat] as [string, string, string[]] | undefined;
  if (!spec) return [];
  const field = spec[1], cats = spec[2];
  return byDate(games, g => (g.cat && cats.includes(g.cat) && typeof g[field] === 'number') ? g[field] : null);
}
function part(g: any, cat: string, fields: string[]) {
  if (g.cat !== cat) return null;
  let s = 0, seen = false;
  for (const f of fields) if (typeof g[f] === 'number') { s += g[f]; seen = true; }
  return seen ? s : null;
}
function valuesFor(games: any[], meta: Meta) {
  if (meta.stat) return statValues(games, meta.stat);
  if (meta.agg === 'lngPass') return byDate(games, g => g.cat === 'passing' && typeof g.lng === 'number' ? g.lng : null, 'max');
  if (meta.agg === 'lngRush') return byDate(games, g => g.cat === 'rushing' && typeof g.lng === 'number' ? g.lng : null, 'max');
  if (meta.agg === 'lngRec') return byDate(games, g => g.cat === 'receiving' && typeof g.lng === 'number' ? g.lng : null, 'max');
  if (meta.agg === 'passRushYds') return byDate(games, g => part(g, 'passing', ['passYds', 'primYds']) ?? part(g, 'rushing', ['primYds']));
  if (meta.agg === 'prrYds') return byDate(games, g => part(g, 'passing', ['passYds', 'primYds']) ?? part(g, 'rushing', ['primYds']) ?? part(g, 'receiving', ['primYds']));
  if (meta.agg === 'rushRecYds') return byDate(games, g => part(g, 'rushing', ['primYds']) ?? part(g, 'receiving', ['primYds']) ?? part(g, 'passing', ['primYds']));
  if (meta.agg === 'prrTd') return byDate(games, g => part(g, 'passing', ['passTd', 'primTd']) ?? part(g, 'rushing', ['primTd']) ?? part(g, 'receiving', ['primTd']));
  if (meta.agg === 'rushRecTd') return byDate(games, g => part(g, 'rushing', ['primTd']) ?? part(g, 'receiving', ['primTd']) ?? part(g, 'passing', ['primTd']));
  return [];
}

export function hitForMarket(games: any[], market: string, point: number | null) {
  const meta = MARKET_META[market];
  if (!meta || meta.noHit) return null;
  const values = valuesFor(games, meta);
  if (!values.length) return null;
  const yes = !!meta.yes;
  const hits = yes ? values.filter(v => v >= 1).length : values.filter(v => point != null && v > point).length;
  return { hits, games: values.length };
}

const showSide = (side: string) => side === 'Over' || side === 'Yes';
function mainLine(rows: StoredLeg[]) {
  return rows.slice().sort((a, b) => Math.abs((a.price ?? -110) + 110) - Math.abs((b.price ?? -110) + 110))[0];
}

export type LineGroup = { name: string; chips: string[] };

/** One card per player: wrapping chips like "Rec Yds 93.5 · o-111 · hit 4/5". */
export function groupsFromLegs(roster: { name: string; games?: any[] }[], legs: StoredLeg[]): LineGroup[] {
  const out: LineGroup[] = [];
  const claimed = new Set<string>();
  const pool = (legs || []).filter(l => showSide(l.side) && l.player && !/d\/st/i.test(l.player));
  const take = (name: string, games?: any[]) => {
    const mine = pool.filter(l => samePlayer(l.player, name) && !claimed.has(`${l.market}|${l.player}|${l.point}`));
    if (!mine.length) return;
    const by = new Map<string, StoredLeg[]>();
    for (const l of mine) { const a = by.get(l.market) || []; a.push(l); by.set(l.market, a); claimed.add(`${l.market}|${l.player}|${l.point}`); }
    const ordered = PLAYER_MARKETS.map(m => by.get(m)).filter(Boolean).map(rows => mainLine(rows!));
    const chips = ordered.map(l => {
      const meta = MARKET_META[l.market];
      const hit = games ? hitForMarket(games, l.market, l.point) : null;
      return formatChip(meta?.label || l.market, l.point, l.price, l.side, hit);
    });
    if (chips.length) out.push({ name, chips });
  };
  for (const p of roster) take(p.name, p.games);
  const leftovers = new Map<string, StoredLeg>();
  for (const l of pool) if (![...claimed].some(k => k.startsWith(`${l.market}|${l.player}|`))) leftovers.set(l.player, l);
  for (const name of leftovers.keys()) take(name);
  return out;
}

export function chipForLeg(games: any[] | undefined, leg: StoredLeg) {
  const meta = MARKET_META[leg.market];
  if (!meta) return '';
  return formatChip(meta.label, leg.point, leg.price, leg.side, games ? hitForMarket(games, leg.market, leg.point) : null);
}
