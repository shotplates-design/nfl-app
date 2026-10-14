'use client'; import { useEffect, useRef, useState } from 'react'; import Link from 'next/link'; import { usePathname } from 'next/navigation';
const LINKS:[string,string][]=[['/','Home (Best Props)'],['/matchups','Matchups'],['/players','Players'],['/teams','Teams'],['/streaks','Streaks'],['/sleepers','Sleepers'],['/dashboard','Dashboard'],['/leaders','Leaders'],['/insights','Insights'],['/compare','Compare'],['/watchlist','★ Watchlist'],['/login','Log in / account']];
export default function MenuDrawer(){ const [open,setOpen]=useState(false); const panel=useRef<HTMLDivElement>(null); const btn=useRef<HTMLButtonElement>(null); const path=usePathname();
  useEffect(()=>{ setOpen(false); },[path]);
  useEffect(()=>{ if(!open) return; const el=panel.current!; const f=()=>Array.from(el.querySelectorAll<HTMLElement>('a,button')); f()[0]?.focus(); document.body.style.overflow='hidden';
    const key=(e:KeyboardEvent)=>{ if(e.key==='Escape'){ setOpen(false); btn.current?.focus(); } if(e.key==='Tab'){ const l=f(); const i=l.indexOf(document.activeElement as HTMLElement);
      if(e.shiftKey&&i<=0){ e.preventDefault(); l[l.length-1].focus(); } else if(!e.shiftKey&&i===l.length-1){ e.preventDefault(); l[0].focus(); } } };
    document.addEventListener('keydown',key); return ()=>{ document.removeEventListener('keydown',key); document.body.style.overflow=''; }; },[open]);
  return <><button ref={btn} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="site-menu" onClick={()=>setOpen(true)} className="p-2 -ml-2 rounded hover:bg-slate-800">
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="stroke-slate-200" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
   {open&&<div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)} aria-hidden="true"/>
    <div ref={panel} id="site-menu" role="dialog" aria-modal="true" aria-label="Site menu" className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto drawer-in">
     <div className="flex items-center justify-between mb-3"><span className="font-bold text-white">🏈 BetStats</span><button type="button" aria-label="Close menu" onClick={()=>{setOpen(false);btn.current?.focus();}} className="p-2 rounded hover:bg-slate-800 text-xl leading-none">×</button></div>
     <nav><ul className="space-y-1">{LINKS.map(([h,l])=><li key={h}><Link href={h} onClick={()=>setOpen(false)} aria-current={path===h?'page':undefined} className={`block rounded px-3 py-2 ${path===h?'bg-emerald-700 text-white':'text-slate-200 hover:bg-slate-800'}`}>{l}</Link></li>)}</ul></nav></div></div>}</>; }
