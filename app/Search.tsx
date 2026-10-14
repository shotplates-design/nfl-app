'use client'; import { useEffect, useState } from 'react'; import Link from 'next/link';
export default function Search(){ const [idx,setIdx]=useState<string[][]>([]); const [q,setQ]=useState('');
  useEffect(()=>{ if(q&&!idx.length) fetch('/search.json').then(r=>r.json()).then(setIdx); },[q,idx.length]);
  const res=q.length>1? idx.filter(p=>p[0].toLowerCase().includes(q.toLowerCase())).slice(0,12):[];
  return <div className="relative"><input aria-label="Search players" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search any NFL player…" className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-base outline-none focus:border-emerald-500"/>
   {res.length>0&&<ul className="absolute w-full mt-1 card p-1 z-20">{res.map(p=><li key={p[1]}><Link href={`/players/${p[1]}`} className="block px-3 py-2 rounded hover:bg-slate-800">{p[0]} <span className="text-slate-400 text-xs">{p[2].toUpperCase()} · {p[3]}</span></Link></li>)}</ul>}</div>; }
