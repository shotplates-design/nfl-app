import Link from 'next/link'; import { notFound } from 'next/navigation'; import { allStreaks, GROUPS, SITE } from '@/lib/data'; import { Crumbs, JsonLd, StreakTable, BENCH_NOTE } from '@/lib/ui';
import { mlabel, mkey } from '@/lib/streaks.mjs';
export const dynamicParams=false;
export function generateStaticParams(){ return Object.keys(GROUPS).map(group=>({group})); }
export function generateMetadata({params}:{params:{group:string}}){ const g=GROUPS[params.group]; if(!g) return {};
 const ms=g.markets.map((m:any)=>mlabel(m[2],m[1])).join(', '); const title=`NFL ${g.label} Prop Streaks – ${g.markets.slice(0,3).map((m:any)=>mlabel(m[2],m[1])).join(', ')}`;
 const description=`Active NFL ${g.label.toLowerCase()} streaks: players hitting or missing ${ms} in consecutive games, with hit rates and game-by-game results.`;
 return {title,description,alternates:{canonical:`/streaks/${params.group}`},openGraph:{title,description,url:`/streaks/${params.group}`}}; }
export default function Page({params}:{params:{group:string}}){ const g=GROUPS[params.group]; if(!g) notFound(); const s=allStreaks();
 const hot=s.hot.filter(r=>r.group===params.group), cold=s.cold.filter(r=>r.group===params.group);
 return <><Crumbs items={[['Home','/'],['Streaks','/streaks'],[g.label,`/streaks/${params.group}`]]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:`NFL ${g.label} hot streaks`,url:`${SITE}/streaks/${params.group}`,numberOfItems:hot.length,itemListElement:hot.slice(0,50).map((r,i)=>({'@type':'ListItem',position:i+1,name:`${r.name}: ${r.streak} straight games ${r.label}`,url:`${SITE}/players/${r.slug}`}))}}/>
 <h1>NFL {g.label} Streaks</h1><p className="text-sm text-slate-400">{BENCH_NOTE}</p>
 {g.markets.map((m:any)=>{const k=mkey(m[0],m[1]); const h=hot.filter(r=>r.key===k), c=cold.filter(r=>r.key===k); if(!h.length&&!c.length) return null;
  return <section key={k}><h2 id={k}>{mlabel(m[2],m[1])}</h2>{h.length>0&&<StreakTable rows={h}/>}{c.length>0&&<><h3 className="text-sm text-sky-300 mt-3 mb-1">Cold streaks</h3><StreakTable rows={c}/></>}</section>})}
 <p className="mt-6 text-sm">Other streaks: {Object.entries(GROUPS).filter(([k])=>k!==params.group).map(([k,d]:any)=><Link key={k} href={`/streaks/${k}`} className="mr-3">{d.label}</Link>)}</p></>; }
