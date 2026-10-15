'use client'; import { useState } from 'react'; import Link from 'next/link'; import Chips from './Chips'; import TeamBadge from './TeamBadge'; import { Strip, HitBar } from './StreakView'; import FavButton from './FavButton';
export default function BestProps({rows,start=1,chips=false,preview=false}:{rows:any[],start?:number,chips?:boolean,preview?:boolean}){ const [pos,setPos]=useState('All'); const roles=['All',...Array.from(new Set(rows.map(r=>r.role)))];
  const list=rows.filter(r=>pos==='All'||r.role===pos);
  return <div>{chips&&<Chips label="Position" options={roles.map(r=>[r,r] as [string,string])} value={pos} onChange={setPos}/>}
   <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">{list.map((r,i)=><li key={r.slug||i} className="card min-w-0 overflow-hidden fade-in">
    <div className="flex items-start gap-2 min-w-0"><span className="text-slate-500 text-sm font-bold w-6 shrink-0">{rows.indexOf(r)+start}</span>
     <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 min-w-0 flex-wrap"><TeamBadge code={r.team} name={r.team}/>{preview?<span className="font-bold text-white break-anywhere">{r.name}</span>:<Link href={`/players/${r.slug}`} className="font-bold text-white break-anywhere">{r.name}</Link>}<span className="text-xs text-slate-400 shrink-0">{r.role}</span>{!preview&&<span className="ml-auto shrink-0"><FavButton slug={r.slug} name={r.name}/></span>}</div>
      <div className="text-xs text-slate-400 mt-0.5">{preview?<span>{r.at} {r.oppName}</span>:<Link href={`/matchups/${r.game}`}>{r.at} {r.oppName}</Link>} · {r.kick}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-emerald-300 font-semibold">{r.prop}</span><span className="text-[10px] text-slate-500">line {r.bench}; not a sportsbook line</span></div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"><HitBar hits={r.hits} games={r.games}/><span>{r.streak?`🔥 ${r.streak} straight`:'No active streak'}</span><span>Avg {r.avg.toFixed(1)} vs {r.thr-0.5}</span><span className="text-slate-500">Score {r.score}</span></div>
      <div className="mt-1"><Strip r={{...r,games:r.strip.length,hits:r.strip.filter((s:any)=>s.h).length}}/> <span className="text-[10px] text-slate-500">last {r.strip.length}</span></div>
      <p className="text-xs text-slate-300 mt-1"><span className="text-slate-500">Why:</span> {r.why}</p>
      </div></div></li>)}</ol></div>; }
