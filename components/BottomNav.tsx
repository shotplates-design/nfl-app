'use client'; import Link from 'next/link'; import { usePathname } from 'next/navigation';
const T=[['/matchups','🏈','Matchups'],['/dashboard','🔥','Hot'],['/streaks','📈','Streaks'],['/watchlist','★','Watchlist'],['/players','🔎','Players']];
export default function BottomNav(){ const p=usePathname()||'/';
  return <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-slate-950/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"><ul className="grid grid-cols-5">
   {T.map(([h,i,l])=>{const on=p===h||p.startsWith(h+'/')||(h==='/matchups'&&p==='/');return <li key={h}><Link href={h} aria-current={on?'page':undefined} className={`flex flex-col items-center py-2 text-[11px] no-underline ${on?'text-emerald-400':'text-slate-400'}`}><span aria-hidden className="text-lg leading-none">{i}</span>{l}</Link></li>})}</ul></nav>; }
