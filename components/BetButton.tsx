'use client'; import { useEffect, useId, useState, useSyncExternalStore } from 'react';
type Leg = { id:string; name:string; stat:string; line:number; team?:string; side?:string };
type Link = { book:string; title:string; link:string; kind:'betslip'|'market'|'event' };
const NOTE = '21+ | Gamble responsibly';
let legs:Leg[] = []; const listeners = new Set<()=>void>();
const emit = () => listeners.forEach(fn=>fn());
function subscribe(fn:()=>void){ listeners.add(fn); return ()=>listeners.delete(fn); }
function snapshot(){ return legs; }
function addLeg(l:Leg){ legs = legs.filter(x=>x.id!==l.id).concat(l).slice(-8); emit(); }
function removeLeg(id:string){ legs = legs.filter(x=>x.id!==id); emit(); }
function useLegs(){ return useSyncExternalStore(subscribe, snapshot, ()=>[]); }

async function load(items:Leg[]){ const r=await fetch('/api/bet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({legs:items.map(({name,stat,line,team,side})=>({name,stat,line,team,side}))})});
  if(!r.ok) return null; return r.json() as Promise<{legs:{books:Link[]}[]; parlay:Link[]; note?:string; available?:boolean}>; }
const kindLabel = (k:Link['kind']) => k==='betslip'?'Betslip':k==='market'?'Market':'Game';

function ParlayDock(){ const id=useId(); const mine=useLegs(); const [leader,setLeader]=useState(false); const [data,setData]=useState<{parlay:Link[];note?:string;available?:boolean}|null>(null);
  useEffect(()=>{ const w=window as any; if(!w.__ppSlip) w.__ppSlip=id; setLeader(w.__ppSlip===id); return ()=>{ if(w.__ppSlip===id) delete w.__ppSlip; }; },[id]);
  useEffect(()=>{ if(!leader||mine.length<2){ setData(null); return; } let on=true; load(mine).then(j=>{ if(on) setData(j); }); return ()=>{on=false}; },[leader,mine]);
  if(!leader||mine.length<2) return null;
  return <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(28rem,calc(100%-2rem))] card shadow-lg">
    <div className="flex items-center gap-2"><p className="font-semibold text-white text-sm">Parlay · {mine.length} legs</p><button type="button" className="ml-auto text-xs text-slate-400" onClick={()=>{ legs=[]; emit(); }}>Clear</button></div>
    <ul className="text-xs text-slate-300 mt-1">{mine.map(l=><li key={l.id} className="flex gap-2"><span className="truncate">{l.name}</span><button type="button" className="ml-auto text-slate-500" onClick={()=>removeLeg(l.id)} aria-label={`Remove ${l.name}`}>✕</button></li>)}</ul>
    {data?.available===false?<p className="text-xs text-slate-400 mt-2">No sportsbook link yet.</p>:
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-2">{(data?.parlay||[]).map(p=><a key={p.book} href={p.link} target="_blank" rel="noopener noreferrer" className="bet-btn text-sm">{p.title}{p.kind==='event'?' (game)':p.kind==='market'?' (market)':''}</a>)}
      {data && !data.parlay?.length && <p className="text-xs text-slate-400">No parlay link for these legs.</p>}</div>}
    <p className="text-[10px] text-slate-500 mt-2">{data?.note||NOTE}</p></div>; }

export default function BetButton({name,stat,line,team,side}:{name:string;stat:string|null;line:number;team?:string;side?:string}){
  const [open,setOpen]=useState(false); const [links,setLinks]=useState<Link[]|null>(null); const [note,setNote]=useState(NOTE); const [empty,setEmpty]=useState(false);
  const id=`${name}|${stat}|${line}|${side||'over'}`; const picked=useLegs().some(l=>l.id===id);
  if(!stat) return null;
  const show=async()=>{ setOpen(v=>!v); if(links) return; const j=await load([{id,name,stat,line,team,side}]); if(!j){ setEmpty(true); return; } setLinks(j.legs?.[0]?.books||[]); setEmpty(j.available===false); if(j.note) setNote(j.note); };
  return <div className="relative w-full sm:w-auto sm:inline-block"><button type="button" onClick={show} className="bet-btn ghost">Bet this</button>
    {open&&<div className="z-20 mt-1 w-full sm:absolute sm:w-56 card !p-2 text-left shadow-lg">{!links&&!empty?<p className="text-xs text-slate-500">Checking books…</p>:empty?<p className="text-xs text-slate-400">No sportsbook link for this prop yet.</p>:links&&!links.length?<p className="text-xs text-slate-400">No link for this prop.</p>:
      <ul className="space-y-1">{(links||[]).map(l=><li key={l.book}><a href={l.link} target="_blank" rel="noopener noreferrer" className="bet-btn ghost text-sm">{l.title} · {kindLabel(l.kind)}</a></li>)}</ul>}
      <button type="button" className="mt-2 text-xs text-slate-300" onClick={()=>picked?removeLeg(id):addLeg({id,name,stat,line,team,side})}>{picked?'Remove from parlay':'Add to parlay'}</button>
      <p className="text-[10px] text-slate-500 mt-1">{note}</p></div>}
    <ParlayDock/></div>; }
