'use client'; import { useMemo, useState } from 'react'; import Link from 'next/link'; import Chips from '@/components/Chips';
const POS:[string,string][]=[['all','All'],['passing','QB'],['rushing','RB'],['receiving','WR/TE'],['defense','Defense'],['kicking','K'],['punting','P']];
const PL:Record<string,string>={passing:'QB',rushing:'RB',receiving:'WR/TE',defense:'DEF',kicking:'K',punting:'P'};
export default function PlayerSearch({list,teams}:{list:[string,string,string,string][],teams:string[]}){ const [q,setQ]=useState(''); const [t,setT]=useState('all'); const [pos,setPos]=useState('all');
  const r=useMemo(()=>{ const s=q.trim().toLowerCase(); return list.filter(([,n,tm,c])=>(!s||n.toLowerCase().includes(s))&&(t==='all'||tm===t)&&(pos==='all'||c===pos)); },[q,t,pos,list]);
  return <div><div className="card sticky top-12 z-[5] space-y-2"><label htmlFor="ps-q" className="sr-only">Search players by name</label>
   <input id="ps-q" type="search" autoComplete="off" placeholder="Search players by name…" value={q} onChange={e=>setQ(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-base"/>
   <div className="flex flex-wrap items-center gap-2"><label htmlFor="ps-t" className="text-xs text-slate-400">Team</label><select id="ps-t" value={t} onChange={e=>setT(e.target.value)} className="rounded bg-slate-950 border border-slate-700 px-2 py-1 text-sm"><option value="all">All teams</option>{teams.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></div>
   <Chips label="Position" options={POS} value={pos} onChange={setPos}/><p className="text-xs text-slate-500" aria-live="polite">{r.length} players</p></div>
   <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm mt-3">{r.map(([s,n,tm,c])=><li key={s} className="truncate"><Link href={`/players/${s}`}>{n}</Link> <span className="text-slate-500 text-xs">{tm.toUpperCase()} {PL[c]||''}</span></li>)}</ul>
</div>; }
