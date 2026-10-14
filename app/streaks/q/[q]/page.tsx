import Link from 'next/link'; import { notFound } from 'next/navigation'; import { players, SITE } from '@/lib/data'; import { Crumbs, JsonLd, Strip, HitBar } from '@/lib/ui'; import PropBuilder from '@/components/PropBuilder'; import { POPULAR, runQuery, buildPgames, STATS } from '@/lib/props.mjs';
export const dynamicParams=false;
export function generateStaticParams(){ return POPULAR.map(p=>({q:p.slug})); }
const find=(s:string)=>POPULAR.find(p=>p.slug===s);
let pg:any=null; const rows=(q:any)=>runQuery(pg ||= buildPgames(players),q) as any[];
export function generateMetadata({params}:{params:{q:string}}){ const p=find(params.q); if(!p) return {}; const n=rows(p.q).length;
 const title=`NFL ${p.title} (${n} players)`; const description=`${n} NFL players this season: ${p.title.toLowerCase()}. Hit counts, averages and game-by-game results from game logs.`;
 return {title,description,alternates:{canonical:`/streaks/q/${p.slug}`},openGraph:{title,description,url:`/streaks/q/${p.slug}`}}; }
export default function Page({params}:{params:{q:string}}){ const p=find(params.q); if(!p) notFound(); const r=rows(p.q); const lab=STATS[p.q.stat][0];
 return <><Crumbs items={[['Home','/'],['Streaks','/streaks'],[p.title,`/streaks/q/${p.slug}`]]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:p.title,url:`${SITE}/streaks/q/${p.slug}`,numberOfItems:r.length,itemListElement:r.slice(0,50).map((x,i)=>({'@type':'ListItem',position:i+1,name:`${x.name}: ${x.hits}/${x.games}`,url:`${SITE}/players/${x.slug}`}))}}/>
 <h1>{p.title}</h1><p className="text-sm text-slate-400">{r.length} players match. Over means at or above the line. Figures come from this season's game logs; the line is a reference number, not a sportsbook line.</p>
 <div className="card overflow-x-auto mt-3"><table><thead><tr><th>Player</th><th>Hits</th><th>Avg {lab}</th><th>Game by game</th></tr></thead><tbody>
 {r.slice(0,60).map(x=><tr key={x.slug}><td><Link href={`/players/${x.slug}`}>{x.name}</Link> <span className="text-xs text-slate-500">{x.team.toUpperCase()} · {x.role}</span></td><td><HitBar hits={x.hits} games={x.games}/></td><td>{x.avg.toFixed(1)}</td><td><Strip r={{...x,label:`${p.q.line}+ ${lab}`}}/></td></tr>)}</tbody></table></div>
 <h2>Tweak this search</h2><PropBuilder initial={p.q} syncUrl={false}/>
 <p className="mt-4 text-sm"><Link href={`/streaks?${new URLSearchParams(Object.entries(p.q).map(([k,v])=>[k,String(v)]))}`}>Open in the full builder (shareable URL) →</Link></p>
 <h2>More searches</h2><ul className="text-sm">{POPULAR.filter(x=>x.slug!==p.slug).map(x=><li key={x.slug}><Link href={`/streaks/q/${x.slug}`}>{x.title}</Link></li>)}</ul></>; }
