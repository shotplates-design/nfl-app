'use client'; import { useEffect, useState } from 'react'; import Link from 'next/link'; import { readFavs, mergeRemote } from '@/components/favs'; import FavButton from '@/components/FavButton'; import { usePindex } from '@/components/usePindex';
export default function Watchlist(){ const [f,setF]=useState<Record<string,string>|null>(null); const idx=usePindex();
  useEffect(()=>{ const u=()=>setF(readFavs()); u(); mergeRemote(); window.addEventListener('bs:favs',u); return ()=>window.removeEventListener('bs:favs',u); },[]);
  if(!f||!idx) return <ul className="space-y-2" aria-busy="true">{[0,1,2].map(i=><li key={i} className="skeleton h-16"/>)}</ul>;
  const slugs=Object.keys(f); if(!slugs.length) return <p className="card text-sm text-slate-400">No players yet. Tap ☆ next to any player to add them.</p>;
  return <ul className="grid sm:grid-cols-2 gap-3">{slugs.map(s=>{const p=idx[s]; const hot=p?.st.filter((x:any)=>x[2]&&x[1]>=2).sort((a:any,b:any)=>b[1]-a[1])[0];
   return <li key={s} className="card fade-in flex justify-between gap-3"><div><Link href={`/players/${s}`} className="font-semibold">{p?.n||f[s]}</Link> <span className="text-xs text-slate-500">{p?.t?.toUpperCase()}</span>
    <div className="text-xs mt-1">{hot?<span className="text-emerald-400">🔥 {hot[1]} straight: {hot[0]} ({hot[3]}/{hot[4]})</span>:<span className="text-slate-500">No active hot streak</span>}</div></div><FavButton slug={s} name={p?.n||f[s]}/></li>})}</ul>; }
