'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { readFavs, mergeRemote } from '@/components/favs';
import FavButton from '@/components/FavButton';
import BetButton from '@/components/BetButton';
import { usePindex } from '@/components/usePindex';

type Offer = { name: string; stat: string; line: number; team: string; label: string };
type LinkRow = { book: string; title: string; link: string; kind: 'betslip' | 'market' | 'event' };
const kindLabel = (k: LinkRow['kind']) => k === 'betslip' ? 'Betslip' : k === 'market' ? 'Market' : 'Game';

export default function Watchlist({ member, offers: initial }: { member: boolean; offers: Record<string, Offer> }) {
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [offers, setOffers] = useState(initial);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ available?: boolean; parlay: LinkRow[]; legs: { name: string; books: LinkRow[] }[] } | null>(null);
  const idx = usePindex();
  useEffect(() => { const u = () => setF(readFavs()); u(); mergeRemote(); window.addEventListener('bs:favs', u); return () => window.removeEventListener('bs:favs', u); }, []);
  const slugs = f ? Object.keys(f) : [];
  const asked = useRef('');
  useEffect(() => {
    if (!member || !f) return;
    const missing = Object.keys(f).filter(s => !offers[s]);
    const key = missing.slice().sort().join(',');
    if (!key || asked.current === key) return;
    asked.current = key;
    let live = true;
    fetch('/api/watchlegs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slugs: missing }) })
      .then(r => r.ok ? r.json() : null).then(j => { if (live && j?.offers) setOffers(o => ({ ...o, ...j.offers })); }).catch(() => {});
    return () => { live = false; };
  }, [member, f, offers]);
  if (!f || !idx) return <ul className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <li key={i} className="skeleton h-16"/>)}</ul>;
  if (!slugs.length) return <p className="card text-sm text-slate-400">No players yet. Tap ☆ next to any player to add them.</p>;
  const checked = slugs.filter(s => on[s] !== false);
  const betAll = async () => {
    setBusy(true); setResult(null);
    let map = offers;
    const missing = checked.filter(s => !map[s]);
    if (member && missing.length) {
      const r = await fetch('/api/watchlegs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slugs: missing }) });
      if (r.ok) { const j = await r.json(); map = { ...map, ...j.offers }; setOffers(map); }
    }
    const legs = checked.map(s => map[s]).filter(Boolean).map(o => ({ name: o.name, stat: o.stat, line: o.line, team: o.team, side: 'over' }));
    if (!legs.length) { setBusy(false); setResult({ available: false, parlay: [], legs: [] }); return; }
    const r = await fetch('/api/bet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ legs }) });
    const j = await r.json().catch(() => null);
    setResult(j || { available: false, parlay: [], legs: [] });
    setBusy(false);
  };
  return <div>
    {member && <button type="button" className="bet-btn mb-3" onClick={betAll} disabled={busy}>{busy ? 'Building parlay…' : `Bet watchlist (parlay)${checked.length ? ` · ${checked.length}` : ''}`}</button>}
    {result && <div className="card mb-3 text-sm">
      {result.available === false && !result.parlay?.length ? <p className="text-slate-400">No sportsbook link yet. Checked picks stay selected so you can try again.</p> : <>
        {result.parlay?.length > 0 && <div className="mb-2"><div className="text-xs text-slate-400 mb-1">Parlay</div><div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">{result.parlay.map(p => <a key={p.book} href={p.link} target="_blank" rel="noopener noreferrer" className="bet-btn ghost">{p.title} · {kindLabel(p.kind)}</a>)}</div></div>}
        <ul className="space-y-2">{(result.legs || []).map(l => <li key={l.name} className="min-w-0"><span className="break-anywhere">{l.name}</span>{l.books?.length ? <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-1">{l.books.map(b => <a key={b.book} href={b.link} target="_blank" rel="noopener noreferrer" className="bet-btn ghost text-sm">{b.title} · {kindLabel(b.kind)}</a>)}</div> : <div className="text-xs text-slate-500">No link for this pick.</div>}</li>)}</ul>
      </>}
      <p className="text-[10px] text-slate-500 mt-2">21+ | Gamble responsibly</p>
    </div>}
    <ul className="grid sm:grid-cols-2 gap-3">{slugs.map(s => {
      const p = idx[s]; const hot = p?.st.filter((x: any) => x[2] && x[1] >= 2).sort((a: any, b: any) => b[1] - a[1])[0];
      const offer = offers[s]; const checkedOne = on[s] !== false;
      return <li key={s} className="card fade-in min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          {member && <label className="mt-1 shrink-0"><input type="checkbox" className="h-5 w-5" checked={checkedOne} aria-label={`Include ${p?.n || f[s]} in the parlay`} onChange={e => setOn(o => ({ ...o, [s]: e.target.checked }))}/></label>}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2"><Link href={`/players/${s}`} className="font-semibold break-anywhere">{p?.n || f[s]}</Link> <span className="text-xs text-slate-500 shrink-0">{(offer?.team || p?.t || '').toUpperCase()}</span><span className="ml-auto shrink-0"><FavButton slug={s} name={p?.n || f[s]}/></span></div>
            <div className="mt-1 flex flex-wrap gap-1.5">{hot && <span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-emerald-300">🔥 {hot[1]} straight · {hot[0]} · {hot[3]}/{hot[4]}</span>}{offer && <span className="text-xs rounded-full bg-slate-800 border border-slate-700 px-2 py-1">{offer.label}</span>}{!hot && !offer && <span className="text-xs text-slate-500">No active hot streak</span>}</div>
            {member && offer && <div className="mt-2"><BetButton name={offer.name} stat={offer.stat} line={offer.line} team={offer.team}/></div>}
          </div>
        </div>
      </li>;
    })}</ul>
  </div>;
}
