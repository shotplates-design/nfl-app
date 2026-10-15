'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import BetButton from '@/components/BetButton';
import { setWatchItems } from '@/components/WatchStreak';
import { legStat } from '@/lib/betslip';

type Row = {
  id: string; slug: string; name: string; team: string; stat: string; line: number; dir: 'over' | 'under';
  streak: number; hits: number; games: number; current: number; label: string; gone: boolean;
};
type LinkRow = { book: string; title: string; link: string; kind: 'betslip' | 'market' | 'event' };
type BetData = { legs: { name: string; stat: string; line: number; books: LinkRow[] }[]; parlay: LinkRow[]; note?: string; available?: boolean };
const NOTE = '21+ | Gamble responsibly';
const kindLabel = (k: LinkRow['kind']) => k === 'betslip' ? 'Betslip' : k === 'market' ? 'Market' : 'Game';

export default function WatchStreaks({ rows, bet }: { rows: Row[]; bet: boolean }) {
  const [list, setList] = useState(rows);
  const listRef = useRef(rows);
  const saveChain = useRef(Promise.resolve());
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map(r => [r.id, true])));
  const [slip, setSlip] = useState<BetData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const remove = (id: string) => {
    const next = listRef.current.filter(r => r.id !== id);
    listRef.current = next;
    setList(next);
    setWatchItems(next);
    setSlip(null);
    setErr('');
    saveChain.current = saveChain.current.then(async () => {
      const body = listRef.current;
      try {
        const r = await fetch('/api/watchstreaks', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: body }) });
        if (!r.ok && listRef.current === body) setErr('Couldn’t remove that streak.');
      } catch { if (listRef.current === body) setErr('Couldn’t remove that streak.'); }
    });
  };
  const picked = list.filter(r => checked[r.id]);
  const betAll = async () => {
    const legs = picked.filter(r => legStat({ stat: r.stat })).map(r => ({ name: r.name, stat: r.stat, line: r.line, team: r.team, side: r.dir }));
    setErr(legs.length < picked.length ? 'Checked streaks without a sportsbook market were left out.' : '');
    setSlip(null);
    if (!legs.length) { setErr('None of the checked streaks have a sportsbook market.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/bet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ legs }) });
      if (!r.ok) { setErr('Couldn’t load sportsbook links.'); return; }
      setSlip(await r.json());
    } catch { setErr('Couldn’t load sportsbook links.'); }
    finally { setBusy(false); }
  };
  if (!list.length) return <p className="card text-sm text-slate-400">No streaks yet. Tap ☆ Watch on a top streak or a prop search result.</p>;
  return <div>
    <ul className="space-y-2">{list.map(r => <li key={r.id} className="card flex flex-wrap items-center gap-3">
      {bet && <input type="checkbox" className="accent-emerald-500" checked={!!checked[r.id]} aria-label={`Include ${r.name} in Bet watchlist`} onChange={e => setChecked(c => ({ ...c, [r.id]: e.target.checked }))} />}
      <div className="min-w-0 flex-1">
        <Link href={`/players/${r.slug}`} className="font-semibold">{r.name}</Link> <span className="text-xs text-slate-500">{(r.team || '').toUpperCase()}</span>
        <div className="text-xs text-slate-300">{r.label}</div>
        <div className="text-xs mt-1">{r.gone ? <span className="text-slate-500">Not in this season’s logs</span> : <>{r.current > 0 ? <span className="text-emerald-400">{r.current} straight</span> : <span className="text-slate-400">No active hit streak</span>}<span className="text-slate-400"> · {r.hits}/{r.games} hits</span></>}</div>
      </div>
      <button type="button" onClick={() => remove(r.id)} className="text-xs text-slate-400 underline">Remove</button>
      {bet && legStat({ stat: r.stat }) && <BetButton name={r.name} stat={r.stat} line={r.line} team={r.team} side={r.dir} />}
    </li>)}</ul>
    {bet && <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" onClick={betAll} disabled={busy || !picked.length} className="text-xs rounded-full bg-emerald-600 text-white px-3 py-1 disabled:opacity-40">Bet watchlist</button>
      <span className="text-xs text-slate-500">{picked.length} checked</span>
    </div>}
    {err && <p className="text-xs text-rose-300 mt-2" role="alert">{err}</p>}
    {slip && <BetResult data={slip} />}
    {bet && <p className="text-[10px] text-slate-500 mt-2">{slip?.note || NOTE}</p>}
  </div>;
}

function BetResult({ data }: { data: BetData }) {
  if (data.available === false) return <p className="text-xs text-slate-400 mt-2">Sportsbook lines aren’t cached yet.</p>;
  const parlay = data.parlay || [];
  const covered = new Set(parlay.map(p => p.book));
  const legs = (data.legs || []).map(l => ({ ...l, extra: (l.books || []).filter(b => !covered.has(b.book)) })).filter(l => parlay.length === 0 || l.extra.length || !(l.books || []).length);
  return <div className="mt-3 space-y-2" aria-live="polite">
    {parlay.length > 0 && <div className="flex flex-wrap gap-2">{parlay.map(p => <a key={p.book} href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs rounded-full bg-emerald-600 text-white px-3 py-1 no-underline">{p.title}{p.kind === 'event' ? ' (game)' : ''}</a>)}</div>}
    {legs.length > 0 && <ul className="text-xs space-y-1">{legs.map(l => <li key={`${l.name}|${l.stat}|${l.line}`}>
      <span className="text-slate-300">{l.name}</span>
      {l.extra.map(b => <a key={b.book} href={b.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-emerald-300 no-underline">{b.title} · {kindLabel(b.kind)}</a>)}
      {!l.extra.length && <span className="text-slate-500"> No link</span>}
    </li>)}</ul>}
    {!parlay.length && !legs.length && <p className="text-xs text-slate-400">No link for these streaks.</p>}
  </div>;
}
