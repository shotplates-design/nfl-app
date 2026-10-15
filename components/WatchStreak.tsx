'use client';
import { useSyncExternalStore } from 'react';

export type WatchItem = { slug: string; name: string; team: string; stat: string; line: number; dir?: 'over' | 'under'; streak?: number };
type Saved = Required<Pick<WatchItem, 'slug' | 'name' | 'team' | 'stat' | 'line' | 'dir' | 'streak'>>;

let items: Saved[] | null = null;
const listeners = new Set<() => void>();
let started = false;
const emit = () => listeners.forEach(fn => fn());
const idOf = (i: { slug: string; stat: string; line: number; dir?: string }) => `${i.slug}|${i.stat}|${i.line}|${i.dir === 'under' ? 'under' : 'over'}`;

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!started) { started = true; pull(); }
  return () => listeners.delete(fn);
}
async function pull() {
  try {
    const r = await fetch('/api/watchstreaks', { cache: 'no-store' });
    const j = r.ok ? await r.json() : { items: [] };
    items = Array.isArray(j.items) ? j.items : [];
  } catch { items = []; }
  emit();
}
function toSaved(list: WatchItem[]): Saved[] {
  return list.slice(-100).map(i => ({ slug: i.slug, name: i.name, team: i.team, stat: i.stat, line: Number(i.line), dir: i.dir === 'under' ? 'under' : 'over', streak: Math.max(0, Math.round(Number(i.streak) || 0)) }));
}
export function setWatchItems(list: WatchItem[]) { items = toSaved(list); emit(); }
async function save(next: Saved[]) {
  items = next;
  emit();
  const r = await fetch('/api/watchstreaks', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: next }) });
  if (!r.ok) pull();
}

export default function WatchStreakButton({ item }: { item: WatchItem }) {
  const list = useSyncExternalStore(subscribe, () => items, () => null);
  const dir = item.dir === 'under' ? 'under' : 'over';
  const id = idOf({ ...item, dir });
  const on = !!list?.some(x => idOf(x) === id);
  const ready = list !== null;
  const toggle = () => {
    if (!ready) return;
    const cur = list || [];
    const row: Saved = { slug: item.slug, name: item.name, team: item.team, stat: item.stat, line: item.line, dir, streak: Math.max(0, Math.round(Number(item.streak) || 0)) };
    const next = (on ? cur.filter(x => idOf(x) !== id) : cur.filter(x => idOf(x) !== id).concat(row)).slice(-100);
    save(next);
  };
  return <button type="button" disabled={!ready} aria-pressed={on} aria-label={`${on ? 'Stop watching' : 'Watch'} ${item.name}`} onClick={toggle}
    className={`text-xs whitespace-nowrap rounded-full border px-2 py-1 disabled:opacity-50 ${on ? 'border-amber-400 text-amber-300' : 'border-slate-600 text-slate-300'}`}>{on ? '★ Watching' : '☆ Watch'}</button>;
}
