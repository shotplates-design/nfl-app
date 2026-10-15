import Link from 'next/link'; import { notFound } from 'next/navigation'; import { weeks, findGame, fmtKick, teamStreaks, teamName } from '@/lib/matchups'; import { Crumbs, JsonLd, StreakTable, BENCH_NOTE } from '@/lib/ui'; import { SITE } from '@/lib/data'; import TeamBadge, { teamColor } from '@/components/TeamBadge'; import { WeatherBadge, Injuries } from '@/components/Conditions'; import { viewerIsMember } from '@/lib/viewer'; import { oddsEnabled } from '@/lib/odds';
export const dynamic='force-dynamic';
export const dynamicParams=false;
export function generateStaticParams(){ return weeks().flatMap(w=>w.games.map(g=>({game:g.slug}))); }
export function generateMetadata({params}:{params:{game:string}}){ const f=findGame(params.game); if(!f) return {}; const {w,g}=f;
 const title=`${g.away} vs ${g.home} Week ${w.week} ${w.season}: Player Prop Streaks & Matchup Breakdown`;
 const description=`${g.away} at ${g.home}, ${fmtKick(g.kickoff)}. Active player streaks, hit rates vs standard benchmarks, and team strengths & weaknesses for both sides.`;
 return {title,description,alternates:{canonical:`/matchups/${g.slug}`},openGraph:{title,description,url:`/matchups/${g.slug}`,type:'article'}}; }
const Side=({name,code,str,weak,bet}:{name:string,code:string,str?:string[],weak?:string[],bet?:boolean})=>{ const t=teamStreaks(code); return <section className="mt-6"><h2 className="flex items-center gap-2"><TeamBadge code={code} name={teamName(code)} size="md"/><Link href={`/teams/${code}`}>{teamName(code)}</Link></h2>
 {(str?.length||weak?.length)?<div className="grid sm:grid-cols-2 gap-2 text-sm mb-3"><div className="card"><div className="text-xs text-emerald-400 mb-1">Strengths (supplied team analysis)</div>{str?.join(' · ')}</div><div className="card"><div className="text-xs text-rose-400 mb-1">Weaknesses</div>{weak?.join(' · ')}</div></div>:null}
 <h3 className="text-sm font-semibold mb-1">🔥 Active hot streaks</h3>{t.hot.length?<StreakTable rows={t.hot} bet={bet}/>:<p className="text-sm text-slate-500">None.</p>}
 {t.cold.length>0&&<><h3 className="text-sm font-semibold mt-3 mb-1">🧊 Cold streaks</h3><StreakTable rows={t.cold} bet={bet}/></>}</section>; };
export default async function Page({params}:{params:{game:string}}){ const f=findGame(params.game); if(!f) notFound(); const {w,g}=f; const a=g.analysis; const bet=(await viewerIsMember())&&oddsEnabled();
 return <article><Crumbs items={[['Home','/'],['Matchups','/matchups'],[`${g.away} @ ${g.home}`,`/matchups/${g.slug}`]]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'SportsEvent',name:`${g.away} at ${g.home}`,sport:'American Football',startDate:g.kickoff||undefined,eventStatus:'https://schema.org/EventScheduled',
  awayTeam:{'@type':'SportsTeam',name:teamName(g.awayCode),url:`${SITE}/teams/${g.awayCode}`},homeTeam:{'@type':'SportsTeam',name:teamName(g.homeCode),url:`${SITE}/teams/${g.homeCode}`},
  location:{'@type':'Place',name:g.venue||`${teamName(g.homeCode)} home stadium`},url:`${SITE}/matchups/${g.slug}`}}/>
 <h1 className="flex items-center gap-2 flex-wrap"><TeamBadge code={g.awayCode} name={g.away} size="lg"/>{g.away} @ <TeamBadge code={g.homeCode} name={g.home} size="lg"/>{g.home}</h1><div aria-hidden="true" className="h-1 rounded my-2" style={{background:`linear-gradient(90deg,${teamColor(g.awayCode)} 50%,${teamColor(g.homeCode)} 50%)`}}/><p className="text-sm text-slate-400">NFL Week {w.week} · {fmtKick(g.kickoff)}{g.network?` · ${g.network}`:''}{g.venue?` · ${g.venue}`:''}</p>
 {g.cond&&<div className="card mt-3"><h2 className="text-sm font-semibold">Game conditions</h2><WeatherBadge w={g.cond.weather} updated={g.condUpdated} full/><Injuries list={g.cond.injuries} full/></div>}
 {a&&<div className="card mt-3 text-sm"><div className="font-semibold mb-1">Matchup model: {a.lean}</div><table><thead><tr><th>Category</th><th>{g.away}</th><th>{g.home}</th><th>Edge</th></tr></thead><tbody>
  {Object.entries(a.categories||{}).map(([k,v]:any)=><tr key={k}><td>{k.replace(/_/g,' ')}</td><td>{v.away}</td><td>{v.home}</td><td className={v.edge>0?'text-emerald-400':v.edge<0?'text-rose-400':''}>{v.edge>0?`${g.away} +${v.edge}`:v.edge<0?`${g.home} +${-v.edge}`:'even'}</td></tr>)}</tbody></table>
  <p className="text-xs text-slate-500 mt-1">Scores and edges as supplied (0–1 scale); not betting lines.</p></div>}
 <p className="text-xs text-slate-500 mt-3">{BENCH_NOTE}</p>
 <Side name={g.away} code={g.awayCode} str={g.away_strengths} weak={g.away_weaknesses} bet={bet}/><Side name={g.home} code={g.homeCode} str={g.home_strengths} weak={g.home_weaknesses} bet={bet}/>
 <p className="mt-6 text-sm"><Link href="/matchups">← All Week {w.week} matchups</Link></p></article>; }
