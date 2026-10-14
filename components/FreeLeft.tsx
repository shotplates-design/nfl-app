'use client'; import { useEffect, useState } from 'react'; import { usePathname } from 'next/navigation';
// Live "X of 5 free player lookups left" for non-members. Fetches fresh (no shared cache) on every route change so it reflects the latest view.
export default function FreeLeft({className=''}:{className?:string}){ const path=usePathname(); const [n,setN]=useState<number|null>(null);
  useEffect(()=>{ let on=true; fetch('/api/me',{cache:'no-store'}).then(r=>r.json()).then(j=>{ if(on) setN(typeof j.freeLeft==='number'?j.freeLeft:null); }).catch(()=>{}); return ()=>{on=false}; },[path]);
  if(n===null) return null; return <p className={`text-xs text-amber-200 ${className}`} aria-live="polite">{n} of 5 free player lookups left</p>; }
