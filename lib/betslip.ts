// Cached sportsbook line shape and player-name matching. No betslip or parlay links.
export const STAT_MARKET: Record<string, string> = {
  passYds: 'player_pass_yds', passTd: 'player_pass_tds', cmp: 'player_pass_completions', passAtt: 'player_pass_attempts', int: 'player_pass_interceptions',
  rushYds: 'player_rush_yds', car: 'player_rush_attempts', rushTd: 'player_rush_tds',
  recYds: 'player_reception_yds', rec: 'player_receptions', recTd: 'player_reception_tds', rrTd: 'player_anytime_td',
  tackles: 'player_tackles_assists', solo: 'player_solo_tackles', sacks: 'player_sacks', defInt: 'player_defensive_interceptions',
  fgm: 'player_field_goals', xpm: 'player_pats', kPts: 'player_kicking_points',
};
export type StoredLeg = {
  player: string; display: string; market: string; point: number | null; side: string;
  eventId: string; home: string; away: string;
  price?: number;
};

export function normName(s: string) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’.]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
export function samePlayer(a: string, b: string) { const x = normName(a), y = normName(b); if (!x || !y) return false; return x === y || x.endsWith(' ' + y) || y.endsWith(' ' + x); }
export function legStat(r: { stat?: string; field?: string; group?: string } | null | undefined) {
  const f = r?.stat || r?.field || '';
  if (f in STAT_MARKET) return f;
  if (f === 'primYds') return r?.group === 'receiving' ? 'recYds' : 'rushYds';
  if (f === 'primTd') return 'rrTd';
  return null;
}
