'use client'; import { useState } from 'react'; import Link from 'next/link'; import Chips from './Chips'; import { Strip, HitBar } from './StreakView'; import FavButton from './FavButton';
const Side=({name,rows,n}:{name:string,rows:any[],n:number})=><div><div className="text-xs font-semibold mb-1">{name}</div><ul className="space-y-1 text-xs">{rows.slice(0,n).map(r=><li key={r.slug} className="fade-in">
  <div className="flex justify-between gap-2"><span className="truncate"><Link href={`/players/${r.slug}`}>{r.name}</Link></span><span className="whitespace-nowrap text-emerald-400">🔥{r.streak}</span></div>
  <div className="text-slate-400 flex justify-between gap-2"><span>{r.label}</span><HitBar hits={r.hits} games={r.games}/></div>{n>3&&<div className="mt-1 flex items-center gap-2"><Strip r={r}/><FavButton slug={r.slug} name={r.name}/></div>}</li>)}{!rows.length&&<li className="text-slate-500">No active streaks</li>}</ul></div>;
export default function MatchupGrid({games}:{games:any[]}){ const days=Array.from(new Set(games.map(g=>g.day))); const [d,setD]=useState('All'); const [open,setOpen]=useState<string|null>(null); const [sort,setSort]=useState<'time'|'heat'>('time');
  const list=games.filter(g=>d==='All'||g.day===d).sort((a,b)=>sort==='heat'?b.heat-a.heat:0);
  return <div><div className="flex flex-wrap gap-x-4 mb-2"><Chips label="Day" options={[['All','All games'],...days.map(x=>[x,x] as [string,string])]} value={d} onChange={setD}/><Chips label="Sort games" options={[['time','Kickoff'],['heat','Most hot streaks']]} value={sort} onChange={setSort}/></div>
   <ul className="grid md:grid-cols-2 gap-3">{list.map(g=>{const o=open===g.slug; return <li key={g.slug} className="card fade-in transition-all">
    <button type="button" aria-expanded={o} aria-controls={`m-${g.slug}`} onClick={()=>setOpen(o?null:g.slug)} className="w-full text-left">
     <div className="flex justify-between items-baseline gap-2"><span className="font-bold text-white">{g.away} @ {g.home}</span><span className="text-xs text-slate-400 whitespace-nowrap">{g.kick}{g.network?` · ${g.network}`:''}</span></div>
     {g.venue&&<div className="text-xs text-amber-300">{g.venue}</div>}{g.lean&&<div className="text-xs text-sky-300 mt-1">Model lean: {g.lean}</div>}
     <div className="text-xs text-slate-500 mt-1">{g.heat} active hot streaks · <span className="text-emerald-400">{o?'Hide players ▲':'Show players ▼'}</span></div></button>
    <div id={`m-${g.slug}`} className="grid grid-cols-2 gap-3 mt-2"><Side name={g.away} rows={g.a} n={o?8:3}/><Side name={g.home} rows={g.h} n={o?8:3}/></div>
    <Link href={`/matchups/${g.slug}`} className="text-xs mt-2 inline-block">Full matchup breakdown →</Link></li>})}</ul></div>; }
