'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { readFavs, mergeRemote } from '@/components/favs';
import FavButton from '@/components/FavButton';
import { usePindex } from '@/components/usePindex';

type Offer = { name: string; stat: string; line: number; team: string; label: string };

export default function Watchlist({ member, offers: initial }: { member: boolean; offers: Record<string, Offer> }) {
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [offers, setOffers] = useState(initial);
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
  return <ul className="grid sm:grid-cols-2 gap-3">{slugs.map(s => {
    const p = idx[s]; const hot = p?.st.filter((x: any) => x[2] && x[1] >= 2).sort((a: any, b: any) => b[1] - a[1])[0];
    const offer = offers[s];
    return <li key={s} className="card fade-in min-w-0">
      <div className="min-w-0">
        <div className="flex items-start gap-2"><Link href={`/players/${s}`} className="font-semibold break-anywhere">{p?.n || f[s]}</Link> <span className="text-xs text-slate-500 shrink-0">{(offer?.team || p?.t || '').toUpperCase()}</span><span className="ml-auto shrink-0"><FavButton slug={s} name={p?.n || f[s]}/></span></div>
        <div className="mt-1 flex flex-wrap gap-1.5">{hot && <span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-emerald-300">🔥 {hot[1]} straight · {hot[0]} · {hot[3]}/{hot[4]}</span>}{offer && <span className="text-xs rounded-full bg-slate-800 border border-slate-700 px-2 py-1 break-anywhere">{offer.label}</span>}{!hot && !offer && <span className="text-xs text-slate-500">No active hot streak</span>}</div>
      </div>
    </li>;
  })}</ul>;
}
