import fs from 'fs';
import path from 'path';
import { currentWeek } from './matchups';

// Drop-in file: data/week-N-injury-analysis.json (curated desk + Kenzie picks).
// loadInjuryDesk prefers the current week's analysis, else data/week-N-conditions.json
// (auto-refreshed by scripts/refresh_injuries.py from ESPN), else the newest
// of either. Swap the analysis file for a curated Friday/Sunday update when you have one.
// Optional lock clock so Kenzie's picks can be marked final after kickoff:
//   "kenzie_picks_final_after": "2026-10-15T20:15:00-04:00"  — applies to every pick
//   "kickoffs": { "SEA@DEN": "2026-10-15T20:15:00-04:00" }   — used when a pick has "game"
//   each pick may set "final_after" or "kickoff" to override
export type InjuryPerson = {
  player: string;
  position: string;
  team: string;
  why: string;
  key_stat_with_without: string;
};
export type ExploitedBy = {
  player: string;
  team: string;
  why: string;
  alignment_notes: string;
};
export type ExpertTake = {
  source_name: string;
  author: string;
  quote_or_paraphrase: string;
  url: string;
  date: string;
};
export type InjuryItem = {
  id: string;
  game: string;
  team: string;
  player: string;
  position: string;
  status: string;
  status_official: boolean;
  injury: string;
  severity: string;
  team_impact: string;
  coverage_role: string;
  beneficiaries: InjuryPerson[];
  opponent_beneficiaries: InjuryPerson[];
  exploited_by: ExploitedBy[];
  betting_angle: string;
  confidence: string;
  expert_takes: ExpertTake[];
  sources: string[];
  matchup_note: string;
};
export type KenziePick = {
  player: string;
  team: string;
  prop: string;
  pick: string;
  confidence: number;
  reasoning: string;
  linked_injury: string;
  links: { id: string; label: string; game: string }[];
  sources: string[];
  final_after: string;
  status: string;
};
export type MatchupSpotlight = {
  game: string;
  title: string;
  body: string;
  sources: string[];
};
export type InjuryDesk = {
  week: number;
  updated: string;
  headline_summary: string[];
  injuries: InjuryItem[];
  kenzie_picks: KenziePick[];
  kenzie_picks_note: string;
  kenzie_picks_final_after: string;
  matchup_spotlights: MatchupSpotlight[];
};

const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const https = (u: unknown) => typeof u === 'string' && u.startsWith('https://') ? u : '';
const text = (v: unknown, n: number) => String(v || '').slice(0, n);
const SPLIT_BITS: [string, string][] = [['games', 'games'], ['carries_pg', 'carries/g'], ['rush_yds_pg', 'rush yds/g'], ['targets_pg', 'targets/g'], ['rec_yds_pg', 'rec yds/g'], ['carries', 'carries'], ['rush_yds', 'rush yds'], ['targets', 'targets'], ['rec_yds', 'rec yds']];
function splitSide(label: string, raw: unknown) {
  if (!raw || typeof raw !== 'object') return '';
  const row = raw as Record<string, unknown>;
  const bits = SPLIT_BITS.filter(([k]) => row[k] != null && row[k] !== '').map(([k, lab]) => k === 'games' && Number(row[k]) === 1 ? '1 game' : `${row[k]} ${lab}`);
  if (typeof row.note === 'string' && row.note.trim()) bits.push(row.note.trim());
  return bits.length ? `${label}: ${bits.join(', ')}` : '';
}
/** A string stays as written. A with/without object becomes one readable line so the split is not "[object Object]". */
export function formatWithWithout(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v.slice(0, 1200);
  if (typeof v !== 'object') return String(v).slice(0, 1200);
  const raw = v as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, val] of Object.entries(raw)) {
    if (k === 'small_sample' || k === 'source_url' || k === 'extra') continue;
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const line = splitSide(label, val);
    if (line) parts.push(line);
  }
  if (raw.small_sample === true) parts.push('Small sample');
  if (typeof raw.extra === 'string' && raw.extra.trim()) parts.push(raw.extra.trim());
  return parts.join('. ').slice(0, 1200);
}
function clock(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && Number.isFinite(Date.parse(s)) ? s : '';
}
export function pickIsFinal(finalAfter: string, now = Date.now()): boolean {
  const t = Date.parse(finalAfter);
  return Number.isFinite(t) && now >= t;
}
function person(raw: any): InjuryPerson | null {
  const player = text(raw?.player, 120);
  if (!player) return null;
  return {
    player,
    position: text(raw?.position, 24),
    team: text(raw?.team, 8).toUpperCase(),
    why: text(raw?.why, 1000),
    key_stat_with_without: formatWithWithout(raw?.key_stat_with_without),
  };
}
function exploited(raw: any): ExploitedBy | null {
  const player = text(raw?.player, 120);
  if (!player) return null;
  return {
    player,
    team: text(raw?.team, 8).toUpperCase(),
    why: text(raw?.why, 1000),
    alignment_notes: text(raw?.alignment_notes, 800),
  };
}
function take(raw: any): ExpertTake | null {
  const quote = typeof raw?.quote_or_paraphrase === 'string' ? raw.quote_or_paraphrase : '';
  const source_name = text(raw?.source_name, 160).trim();
  if (!quote && !source_name) return null;
  return {
    source_name,
    author: text(raw?.author, 160).trim(),
    quote_or_paraphrase: quote,
    url: https(raw?.url),
    date: text(raw?.date, 40).trim(),
  };
}
function linkList(raw: unknown, n = 8): string[] {
  return (Array.isArray(raw) ? raw : []).map(https).filter(Boolean).slice(0, n);
}
function files() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) return [] as { week: number; file: string }[];
  return fs.readdirSync(dir).flatMap(name => {
    const m = /^week-(\d+)-injury-analysis\.json$/.exec(name);
    return m ? [{ week: Number(m[1]), file: path.join(dir, name) }] : [];
  }).sort((a, b) => b.week - a.week);
}
function conditionsFiles() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) return [] as { week: number; file: string }[];
  return fs.readdirSync(dir).flatMap(name => {
    const m = /^week-(\d+)-conditions\.json$/.exec(name);
    return m ? [{ week: Number(m[1]), file: path.join(dir, name) }] : [];
  }).sort((a, b) => b.week - a.week);
}
function severityFromStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'out' || s === 'ir' || s.includes('injured reserve')) return 'critical';
  if (s === 'doubtful') return 'significant';
  if (s === 'questionable') return 'moderate';
  if (s === 'pup' || s === 'nfi') return 'significant';
  return 'minor';
}
/** Build a desk from data/week-N-conditions.json so /injuries tracks the auto refresh. */
export function deskFromConditions(raw: any, weekHint: number): InjuryDesk | null {
  if (!raw || typeof raw !== 'object') return null;
  const games = Array.isArray(raw.games) ? raw.games : [];
  if (!games.length) return null;
  const injuries: InjuryItem[] = [];
  for (const game of games) {
    if (!game || typeof game !== 'object') continue;
    const away = text(game.away, 8).toUpperCase();
    const home = text(game.home, 8).toUpperCase();
    const gameKey = away && home ? `${away}@${home}` : '';
    const rows = Array.isArray(game.injuries) ? game.injuries : [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || typeof r !== 'object') continue;
      const player = text(r.player, 80);
      if (!player) continue;
      const team = text(r.team, 8).toUpperCase() || away || home;
      const status = text(r.status, 80);
      const injury = text(r.injury, 160);
      const practice = text(r.practice_latest, 120);
      const note = text(r.note, 500);
      const source = https(r.source_url);
      const impactBits = [practice ? `Practice: ${practice}` : '', note].filter(Boolean);
      injuries.push({
        id: `injury-${slug(`${team}-${player}`) || i}`,
        game: gameKey,
        team,
        player,
        position: text(r.position, 16),
        status: status || (practice ? 'Practice report' : ''),
        status_official: Boolean(status),
        injury,
        severity: severityFromStatus(status),
        team_impact: impactBits.join(' · ').slice(0, 2000),
        coverage_role: '',
        beneficiaries: [],
        opponent_beneficiaries: [],
        exploited_by: [],
        betting_angle: '',
        confidence: '',
        expert_takes: [],
        sources: source ? [source] : [],
        matchup_note: '',
      });
    }
  }
  if (!injuries.length) return null;
  const week = Number(raw.week) || weekHint;
  const updated = text(raw.updated, 40);
  const sourceNote = text(raw.injury_source_note, 400);
  const headline = [
    `Auto injury desk for week ${week} from data/week-${week}-conditions.json.`,
    sourceNote || 'Statuses from the conditions feed (ESPN refresh). Curated analysis, when present for this week, still wins.',
  ];
  return {
    week,
    updated,
    headline_summary: headline,
    injuries,
    kenzie_picks: [],
    kenzie_picks_note: '',
    kenzie_picks_final_after: '',
    matchup_spotlights: [],
  };
}
function parseAnalysisFile(hit: { week: number; file: string }): InjuryDesk | null {
  let raw: any;
  try { raw = JSON.parse(fs.readFileSync(hit.file, 'utf8')); } catch { return null; }
  const injuries: InjuryItem[] = (Array.isArray(raw.injuries) ? raw.injuries : []).map((r: any, i: number) => {
    const player = text(r?.player, 80) || 'Unknown';
    const team = text(r?.team, 8).toUpperCase();
    return {
      id: `injury-${slug(`${team}-${player}`) || i}`,
      game: text(r?.game, 20).toUpperCase(),
      team, player,
      position: text(r?.position, 16),
      status: text(r?.status, 80),
      status_official: r?.status_official !== false,
      injury: text(r?.injury, 160),
      severity: text(r?.severity, 24).toLowerCase(),
      team_impact: text(r?.team_impact, 2000),
      coverage_role: text(r?.coverage_role, 500),
      beneficiaries: (Array.isArray(r?.beneficiaries) ? r.beneficiaries : []).map(person).filter(Boolean) as InjuryPerson[],
      opponent_beneficiaries: (Array.isArray(r?.opponent_beneficiaries) ? r.opponent_beneficiaries : []).map(person).filter(Boolean) as InjuryPerson[],
      exploited_by: (Array.isArray(r?.exploited_by) ? r.exploited_by : []).map(exploited).filter(Boolean) as ExploitedBy[],
      betting_angle: text(r?.betting_angle, 1200),
      confidence: text(r?.confidence, 120),
      expert_takes: (Array.isArray(r?.expert_takes) ? r.expert_takes : []).map(take).filter(Boolean) as ExpertTake[],
      sources: linkList(r?.sources),
      matchup_note: text(r?.matchup_note, 1200),
    };
  });
  const deskFinal = clock(raw.kenzie_picks_final_after);
  const kickoffs = raw.kickoffs && typeof raw.kickoffs === 'object' ? raw.kickoffs as Record<string, unknown> : {};
  const picks: KenziePick[] = (Array.isArray(raw.kenzie_picks) ? raw.kenzie_picks : []).map((p: any) => {
    const linked = text(p?.linked_injury, 400);
    const links = injuries.filter(item => item.player && linked.toLowerCase().includes(item.player.toLowerCase())).map(item => ({ id: item.id, label: `${item.team} ${item.player}`, game: item.game }));
    const n = Number(p?.confidence);
    const game = text(p?.game, 20).toUpperCase();
    const fromMap = clock(kickoffs[game] || kickoffs[game.toLowerCase()]);
    return {
      player: text(p?.player, 80),
      team: text(p?.team, 8).toUpperCase(),
      prop: text(p?.prop, 160),
      pick: text(p?.pick, 12).toLowerCase() === 'under' ? 'under' : 'over',
      confidence: Number.isFinite(n) ? Math.max(1, Math.min(5, Math.round(n))) : 1,
      reasoning: text(p?.reasoning, 2000),
      linked_injury: linked,
      links,
      sources: linkList(p?.sources),
      final_after: clock(p?.final_after) || clock(p?.kickoff) || fromMap || deskFinal,
      status: text(p?.status, 200),
    };
  });
  const spotlights: MatchupSpotlight[] = (Array.isArray(raw.matchup_spotlights) ? raw.matchup_spotlights : []).map((s: any) => ({
    game: text(s?.game, 20).toUpperCase(),
    title: text(s?.title, 160),
    body: text(s?.body, 2000),
    sources: linkList(s?.sources),
  })).filter((s: MatchupSpotlight) => s.title || s.body);
  return {
    week: Number(raw.week) || hit.week,
    updated: text(raw.updated, 40),
    headline_summary: (Array.isArray(raw.headline_summary) ? raw.headline_summary : []).map((s: unknown) => text(s, 800)).filter(Boolean),
    injuries,
    kenzie_picks: picks,
    kenzie_picks_note: text(raw.kenzie_picks_note, 1000),
    kenzie_picks_final_after: deskFinal,
    matchup_spotlights: spotlights,
  };
}

export function loadInjuryDesk(): InjuryDesk | null {
  const analysis = files();
  const conditions = conditionsFiles();
  let week = 6;
  try { week = currentWeek()?.week || week; } catch { /* keep default */ }
  const aHit = analysis.find(f => f.week === week);
  if (aHit) {
    const desk = parseAnalysisFile(aHit);
    if (desk) return desk;
  }
  const cHit = conditions.find(f => f.week === week);
  if (cHit) {
    try {
      const raw = JSON.parse(fs.readFileSync(cHit.file, 'utf8'));
      const desk = deskFromConditions(raw, week);
      if (desk) return desk;
    } catch { /* fall through */ }
  }
  const newestA = analysis[0];
  const newestC = conditions[0];
  if (newestC && (!newestA || newestC.week > newestA.week)) {
    try {
      const raw = JSON.parse(fs.readFileSync(newestC.file, 'utf8'));
      const desk = deskFromConditions(raw, newestC.week);
      if (desk) return desk;
    } catch { /* fall through */ }
  }
  if (newestA) {
    const desk = parseAnalysisFile(newestA);
    if (desk) return desk;
  }
  if (newestC) {
    try {
      const raw = JSON.parse(fs.readFileSync(newestC.file, 'utf8'));
      return deskFromConditions(raw, newestC.week);
    } catch { return null; }
  }
  return null;
}
