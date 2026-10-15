import fs from 'fs';
import path from 'path';
import { currentWeek } from './matchups';

// Drop-in file: data/week-N-injury-analysis.json (this week is data/week-6-injury-analysis.json).
// Replace that file before a kickoff window. The page reads it from disk, current week first, then the newest week on disk.
export type InjuryPerson = {
  player: string;
  position: string;
  team: string;
  why: string;
  key_stat_with_without: string;
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
  beneficiaries: InjuryPerson[];
  opponent_beneficiaries: InjuryPerson[];
  betting_angle: string;
  confidence: string;
  sources: string[];
};
export type KenziePick = {
  player: string;
  team: string;
  prop: string;
  pick: string;
  confidence: number;
  reasoning: string;
  linked_injury: string;
  links: { id: string; label: string }[];
};
export type InjuryDesk = {
  week: number;
  updated: string;
  headline_summary: string[];
  injuries: InjuryItem[];
  kenzie_picks: KenziePick[];
  kenzie_picks_note: string;
};

const slug = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const https = (u: unknown) => typeof u === 'string' && u.startsWith('https://') ? u : '';
function person(raw: any): InjuryPerson | null {
  const player = String(raw?.player || '').slice(0, 120);
  if (!player) return null;
  return {
    player,
    position: String(raw?.position || '').slice(0, 24),
    team: String(raw?.team || '').slice(0, 8).toUpperCase(),
    why: String(raw?.why || '').slice(0, 400),
    key_stat_with_without: String(raw?.key_stat_with_without || '').slice(0, 500),
  };
}
function files() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) return [] as { week: number; file: string }[];
  return fs.readdirSync(dir).flatMap(name => {
    const m = /^week-(\d+)-injury-analysis\.json$/.exec(name);
    return m ? [{ week: Number(m[1]), file: path.join(dir, name) }] : [];
  }).sort((a, b) => b.week - a.week);
}

export function loadInjuryDesk(): InjuryDesk | null {
  const list = files();
  if (!list.length) return null;
  let week = 6;
  try { week = currentWeek()?.week || week; } catch { /* keep default */ }
  const hit = list.find(f => f.week === week) || list[0];
  let raw: any;
  try { raw = JSON.parse(fs.readFileSync(hit.file, 'utf8')); } catch { return null; }
  const injuries: InjuryItem[] = (Array.isArray(raw.injuries) ? raw.injuries : []).map((r: any, i: number) => {
    const player = String(r?.player || 'Unknown').slice(0, 80);
    const team = String(r?.team || '').slice(0, 8).toUpperCase();
    return {
      id: `injury-${slug(`${team}-${player}`) || i}`,
      game: String(r?.game || '').slice(0, 20).toUpperCase(),
      team, player,
      position: String(r?.position || '').slice(0, 16),
      status: String(r?.status || '').slice(0, 80),
      status_official: r?.status_official !== false,
      injury: String(r?.injury || '').slice(0, 160),
      severity: String(r?.severity || '').toLowerCase().slice(0, 24),
      team_impact: String(r?.team_impact || '').slice(0, 800),
      beneficiaries: (Array.isArray(r?.beneficiaries) ? r.beneficiaries : []).map(person).filter(Boolean) as InjuryPerson[],
      opponent_beneficiaries: (Array.isArray(r?.opponent_beneficiaries) ? r.opponent_beneficiaries : []).map(person).filter(Boolean) as InjuryPerson[],
      betting_angle: String(r?.betting_angle || '').slice(0, 500),
      confidence: String(r?.confidence || '').slice(0, 120),
      sources: (Array.isArray(r?.sources) ? r.sources : []).map(https).filter(Boolean).slice(0, 8),
    };
  });
  const picks: KenziePick[] = (Array.isArray(raw.kenzie_picks) ? raw.kenzie_picks : []).map((p: any) => {
    const linked = String(p?.linked_injury || '').slice(0, 300);
    const links = injuries.filter(item => item.player && linked.toLowerCase().includes(item.player.toLowerCase())).map(item => ({ id: item.id, label: `${item.team} ${item.player}` }));
    const n = Number(p?.confidence);
    return {
      player: String(p?.player || '').slice(0, 80),
      team: String(p?.team || '').slice(0, 8).toUpperCase(),
      prop: String(p?.prop || '').slice(0, 120),
      pick: String(p?.pick || '').toLowerCase() === 'under' ? 'under' : 'over',
      confidence: Number.isFinite(n) ? Math.max(1, Math.min(5, Math.round(n))) : 1,
      reasoning: String(p?.reasoning || '').slice(0, 800),
      linked_injury: linked,
      links,
    };
  });
  return {
    week: Number(raw.week) || hit.week,
    updated: String(raw.updated || ''),
    headline_summary: (Array.isArray(raw.headline_summary) ? raw.headline_summary : []).map((s: unknown) => String(s).slice(0, 500)).filter(Boolean),
    injuries,
    kenzie_picks: picks,
    kenzie_picks_note: String(raw.kenzie_picks_note || '').slice(0, 500),
  };
}
