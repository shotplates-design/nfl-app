// Saved prop streaks, stored per user next to player favorites (favs:${email}). Server-only: reads game logs.
import { bySlug } from '@/lib/data';
import { STATS } from '@/lib/props.mjs';

export type SavedStreak = {
  id: string;
  slug: string;
  name: string;
  team: string;
  stat: string;
  line: number;
  dir: 'over' | 'under';
  streak: number;
};
export type LiveStreak = SavedStreak & { hits: number; games: number; current: number; label: string; gone: boolean };

export const watchKey = (email: string) => `favstreaks:${email.trim().toLowerCase()}`;
const STAT_KEYS = new Set(Object.keys(STATS));

export function cleanItem(raw: any): SavedStreak | null {
  const slug = String(raw?.slug || '');
  const stat = String(raw?.stat || '');
  const line = Number(raw?.line);
  const dir: 'over' | 'under' = raw?.dir === 'under' ? 'under' : 'over';
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !STAT_KEYS.has(stat) || !Number.isFinite(line) || line < 0 || line > 2000) return null;
  const id = `${slug}|${stat}|${line}|${dir}`;
  return {
    id, slug, stat, line, dir,
    name: String(raw?.name || '').slice(0, 80),
    team: String(raw?.team || '').slice(0, 8).toLowerCase(),
    streak: Math.max(0, Math.min(99, Math.round(Number(raw?.streak) || 0))),
  };
}

export function asList(v: unknown) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } }
  return [];
}

function series(p: { games: any[] }, stat: string) {
  const def = (STATS as Record<string, any>)[stat];
  if (!def) return [];
  const field = def[1] as string;
  const cats = def[2] as string[];
  const sum = stat === 'rrTd';
  const out: number[] = [];
  const seen = new Map<string, number>();
  for (const g of p.games || []) {
    const gg = g.cat === 'kicking' && typeof g.xp === 'string' && /^\d+-\d+$/.test(g.xp) ? { ...g, xpm: +g.xp.split('-')[0] } : g;
    if (!cats.includes(gg.cat) || typeof gg[field] !== 'number') continue;
    const i = seen.get(gg.date);
    if (i == null) { seen.set(gg.date, out.length); out.push(gg[field]); }
    else out[i] = sum ? out[i] + gg[field] : Math.max(out[i], gg[field]);
  }
  return out;
}

/** Current season hits and active hit streak for a saved line. The stored `streak` stays the value from when it was watched. */
export function hydrate(item: SavedStreak): LiveStreak {
  const def = (STATS as Record<string, any>)[item.stat];
  const lab = def ? def[0] : item.stat;
  const label = item.dir === 'under' ? `under ${item.line} ${lab}` : `${item.line}+ ${lab}`;
  const p = bySlug(item.slug);
  if (!p) return { ...item, hits: 0, games: 0, current: 0, label, gone: true };
  const vals = series(p, item.stat);
  const hit = (v: number) => item.dir === 'under' ? v < item.line : v >= item.line;
  let current = 0;
  for (let i = vals.length - 1; i >= 0 && hit(vals[i]); i--) current++;
  return {
    ...item,
    name: p.name || item.name,
    team: p.team || item.team,
    hits: vals.filter(hit).length,
    games: vals.length,
    current,
    label,
    gone: false,
  };
}

export function liveRows(raw: unknown): LiveStreak[] {
  const out: LiveStreak[] = [];
  const seen = new Set<string>();
  for (const r of asList(raw)) {
    const item = cleanItem(r);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(hydrate(item));
  }
  return out;
}

export function cleanList(raw: unknown): SavedStreak[] {
  const out: SavedStreak[] = [];
  const seen = new Set<string>();
  for (const r of asList(raw).slice(0, 100)) {
    const item = cleanItem(r);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
