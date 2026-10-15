import TeamBadge, { teamColor } from '@/components/TeamBadge';
import Link from 'next/link'; import { notFound } from 'next/navigation'; import { players, teamCodes, teamName, CAT_LABEL, CAT_STATS, catGames, avg, fmt, bestHot, SITE } from '@/lib/data'; import { Crumbs, JsonLd } from '@/lib/ui';
import articles from '@/data/articles.json';
export const dynamicParams=false;
export function generateStaticParams(){ return teamCodes().map(team=>({team})); }
export function generateMetadata({params}:{params:{team:string}}){ const n=teamName(params.team); const title=`${n} Player Stats & Streaks`; const description=`${n} player stats: passing, rushing, receiving and defensive game logs plus prop-benchmark streaks for bettors.`;
 return {title,description,alternates:{canonical:`/teams/${params.team}`},openGraph:{title,description,url:`/teams/${params.team}`}}; }
export default function Page({params}:{params:{team:string}}){ const t=params.team; if(!teamCodes().includes(t)) notFound();
 const roster=players.filter(p=>p.team===t&&p.cat); const sp=players.find(p=>p.team===t&&p.splits.length)?.splits||[];
 const ms=(articles as any[]).filter(a=>a.kind==='matchup'&&a.team===t);
 return <><Crumbs items={[['Home','/'],['Teams','/teams'],[teamName(t),`/teams/${t}`]]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'SportsTeam',name:teamName(t),sport:'American Football',url:`${SITE}/teams/${t}`,athlete:roster.slice(0,50).map(p=>({'@type':'Person',name:p.name,url:`${SITE}/players/${p.slug}`}))}}/>
 <h1 className="flex items-center gap-3"><TeamBadge code={t} name={teamName(t)} size="lg"/>{teamName(t)} Player Stats</h1><div aria-hidden="true" className="h-1 w-24 rounded my-2" style={{background:teamColor(t)}}/>
 {['passing','rushing','receiving','defense','kicking','punting'].map(c=>{const r=roster.filter(p=>p.cat===c).map(p=>({p,a:avg(catGames(p),CAT_STATS[c][0][0]),tr:bestHot(p)})).sort((x,y)=>(y.a??0)-(x.a??0)); if(!r.length) return null;
  return <section key={c}><h2>{CAT_LABEL[c]}</h2><div className="card overflow-x-auto max-w-full"><table className="cards"><thead><tr><th>Player</th><th>G</th><th>Avg {CAT_STATS[c][0][1]}</th><th>Best active streak</th></tr></thead><tbody>
  {r.slice(0,c==='defense'?15:10).map(({p,a,tr})=><tr key={p.slug}><td className="who" data-l="Player"><Link href={`/players/${p.slug}`} className="break-anywhere">{p.name}</Link> <span className="text-xs text-slate-500">{p.team.toUpperCase()}</span></td><td data-l="G">{catGames(p).length}</td><td data-l={`Avg ${CAT_STATS[c][0][1]}`}>{fmt(a)}</td><td data-l="Streak">{tr?`🔥 ${tr.streak}× ${tr.label}`:'—'}</td></tr>)}</tbody></table></div></section>})}
 {sp.length>0&&<><h2>Division standings (as supplied)</h2><div className="card overflow-x-auto max-w-full"><table><thead><tr><th>Team</th><th>W-L-T</th><th>PF</th><th>PA</th></tr></thead><tbody>{sp.map((s:any)=><tr key={s.team}><td>{s.team}</td><td>{s.w}-{s.l}-{s.t}</td><td>{s.pf}</td><td>{s.pa}</td></tr>)}</tbody></table></div></>}
 {ms.length>0&&<><h2>Matchup breakdowns</h2><ul className="text-sm space-y-1">{ms.map(a=><li key={a.slug}><Link href={`/insights/${a.slug}`}>{a.title}</Link></li>)}</ul></>}
 </>; }
