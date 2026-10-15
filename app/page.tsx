import Link from 'next/link'; import Search from './Search'; import { JsonLd } from '@/lib/ui'; import { SITE, SITE_NAME } from '@/lib/data'; import { currentWeek } from '@/lib/matchups'; import { bestProps, SCORE_NOTE } from '@/lib/bestprops'; import BestProps from '@/components/BestProps'; import Gate from '@/components/Gate'; import articles from '@/data/articles.json'; import { viewerIsMember } from '@/lib/viewer';
export const dynamic='force-dynamic';
// Non-members get only the top 3 real props; the locked section is rendered from dummy rows so props 4+ never leave the server.
const DUMMY=Array.from({length:4},(_,i)=>({slug:'locked',name:'Player Name',team:'',role:'WR',at:'vs',opp:'',oppName:'Opponent',kick:'Sun 1:00 PM',prop:'Over 00.5 Yds',bench:'00.5',hits:0,games:5,streak:0,avg:0,thr:1,score:0,strip:Array.from({length:5},()=>({h:true,v:0,v2:0})),why:'Locked. Members see every ranked prop with the full reasoning.'}));
export function generateMetadata(){ const w=currentWeek(); const title=`Best NFL Player Props Week ${w.week} ${w.season}: Hit Rates, Streaks & Matchups`;
 const description=`The strongest NFL Week ${w.week} player props ranked by hit rate, current streak and margin over benchmark lines. Game-by-game results for every pick, players on bye or ruled out excluded.`;
 return {title,description,alternates:{canonical:'/'},openGraph:{title,description,url:'/'}}; }
export default async function Home(){ const w=currentWeek(); const all=bestProps(18); const mem=await viewerIsMember(); const rows=mem?all:all.slice(0,3);
 return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebSite',name:SITE_NAME,url:SITE}}/>
  <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:`Best NFL player props Week ${w.week}`,itemListElement:rows.map((r,i)=>({'@type':'ListItem',position:i+1,name:`${r.name} ${r.prop}`,url:`${SITE}/players/${r.slug}`}))}}/>
  <div className="mb-4"><Search/></div>
  <h1>Best Props This Week: NFL Week {w.week}</h1>
  <p className="text-sm text-slate-400">The {all.length} strongest player props for Week {w.week}, ranked from this season's game logs. Teams on bye{w.byes?.length?` (${w.byes.map(b=>b.toUpperCase()).join(', ')})`:''} and players listed Out are excluded. Each line is set from the player's own game logs (the highest number he clears in 80%+ of games), not a sportsbook line.</p>
  <div className="mt-3"><BestProps rows={rows.slice(0,3)}/></div><div className="mt-3"><Gate label="The full Best Props list">{mem?<BestProps rows={rows.slice(3)} start={4}/>:<BestProps rows={DUMMY as any} start={4} preview/>}</Gate></div>
  <details className="card mt-4 text-xs text-slate-400"><summary className="cursor-pointer text-slate-200">How we rank</summary><p className="mt-2">{SCORE_NOTE} The "Why" line uses these game logs, the supplied matchup report (team strengths and weaknesses), the weather forecast feed, and the weekly injury desk when a player is named on an injury.</p></details>
  <p className="mt-4 text-sm flex flex-wrap gap-3"><Link href="/matchups">All Week {w.week} matchups →</Link><Link href="/streaks">Prop search builder →</Link></p>
  <h2>Latest insights</h2><ul className="text-sm space-y-1">{(articles as any[]).filter(a=>a.kind!=='matchup').slice(0,6).map(a=><li key={a.slug}><Link href={`/insights/${a.slug}`}>{a.title}</Link></li>)}</ul>
 </>; }
