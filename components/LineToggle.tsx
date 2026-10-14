'use client'; import { useState } from 'react'; import Chips from './Chips'; import { HitRing, Strip } from './StreakView';
type M={field:string,name:string,thr:number[],games:{d:string,o:string,v:number}[]};
export default function LineToggle({markets}:{markets:M[]}){ const [mi,setMi]=useState(0); const m=markets[mi]; const [t,setT]=useState(m.thr[Math.min(1,m.thr.length-1)]);
  const thr=m.thr.includes(t)?t:m.thr[0]; const strip=m.games.map(g=>({...g,h:g.v>=thr})); const hits=strip.filter(g=>g.h).length;
  let n=0; const last=strip[strip.length-1]?.h; for(let i=strip.length-1;i>=0&&strip[i].h===last;i--) n++;
  return <div className="card"><div className="space-y-1">{markets.length>1&&<Chips label="Stat" options={markets.map((x,i)=>[i,x.name] as [number,string])} value={mi} onChange={i=>{setMi(i);setT(markets[i].thr[0])}}/>}
   <Chips label="Benchmark line" options={m.thr.map(x=>[x,`${x}+`] as [number,string])} value={thr} onChange={setT}/></div>
   <div className="flex items-center gap-4 mt-3" aria-live="polite"><HitRing key={`${mi}-${thr}`} hits={hits} games={strip.length}/><div><div className="text-sm">Hit <strong>{thr}+ {m.name}</strong> in <strong>{hits} of {strip.length}</strong> games</div>
   <div className={`text-xs ${last?'text-emerald-400':'text-sky-300'}`}>{last?'🔥 Hit':'🧊 Missed'} {n} straight</div><div className="mt-2"><Strip key={`s-${mi}-${thr}`} r={{strip,hits,games:strip.length,label:`${thr}+ ${m.name}`}}/></div></div></div></div>; }
