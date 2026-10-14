import Link from 'next/link'; import { notFound } from 'next/navigation'; import articles from '@/data/articles.json'; import { Crumbs, JsonLd, StreakTable, BENCH_NOTE } from '@/lib/ui'; import { SITE, SITE_NAME, teamName } from '@/lib/data';
const A=articles as any[]; export const dynamicParams=false;
export function generateStaticParams(){ return A.map(a=>({slug:a.slug})); }
export function generateMetadata({params}:{params:{slug:string}}){ const a=A.find(x=>x.slug===params.slug); if(!a) return {};
 return {title:a.title,description:a.description,alternates:{canonical:`/insights/${a.slug}`},openGraph:{title:a.title,description:a.description,url:`/insights/${a.slug}`,type:'article'}}; }
const P=({x}:{x:any})=><Link href={`/players/${x.slug}`}>{x.name}</Link>;
export default function Page({params}:{params:{slug:string}}){ const a=A.find(x=>x.slug===params.slug); if(!a) notFound();
 return <article><Crumbs items={[['Home','/'],['Insights','/insights'],[a.title,`/insights/${a.slug}`]]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.description,datePublished:a.date,dateModified:a.date,author:{'@type':'Organization',name:SITE_NAME},publisher:{'@type':'Organization',name:SITE_NAME},mainEntityOfPage:`${SITE}/insights/${a.slug}`}}/>
 <h1>{a.title}</h1><p className="text-xs text-slate-500 mb-3">Updated {a.date}</p><p className="mb-4">{a.intro}</p>
 {a.kind==='streaks'&&<><p className="text-xs text-slate-500 mb-2">{BENCH_NOTE}</p>{a.hot.length>0&&<><h2>🔥 Hot streaks</h2><StreakTable rows={a.hot}/></>}
  {a.cold.length>0&&<><h2>🧊 Cold streaks</h2><StreakTable rows={a.cold}/></>}<p className="mt-3 text-sm"><Link href={`/streaks/${a.cat}`}>Live {a.cat} streaks →</Link></p></>}
 {a.kind==='performers'&&<div className="card overflow-x-auto"><table><thead><tr><th>Player</th><th>Team</th><th>Opp</th><th>Result</th><th>{a.statLabel}</th></tr></thead><tbody>
  {a.rows.map((x:any)=><tr key={x.slug}><td><P x={x}/></td><td>{x.team.toUpperCase()}</td><td>{x.opp}</td><td>{x.result}</td><td>{x.val}</td></tr>)}</tbody></table></div>}
 {a.kind==='matchup'&&<><ul className="text-sm space-y-1">{a.rows.map((x:any)=><li key={x.slug+x.cat}><P x={x}/> – {x.val} {x.label}</li>)}</ul>
  <p className="mt-4 text-sm"><Link href={`/teams/${a.team}`}>More {teamName(a.team)} stats →</Link></p></>}
 {a.cat&&a.kind!=='streaks'&&<p className="mt-4 text-sm"><Link href={`/leaders/${a.cat}`}>Full leaderboard →</Link></p>}
 </article>; }
