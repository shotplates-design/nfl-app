import Link from 'next/link'; import Search from './Search'; import { JsonLd } from '@/lib/ui'; import { SITE, SITE_NAME } from '@/lib/data'; import { currentWeek } from '@/lib/matchups'; import { bestProps, SCORE_NOTE } from '@/lib/bestprops'; import BestProps from '@/components/BestProps'; import articles from '@/data/articles.json';
export function generateMetadata(){ const w=currentWeek(); const title=`Best NFL Player Props Week ${w.week} ${w.season}: Hit Rates, Streaks & Matchups`;
 const description=`The strongest NFL Week ${w.week} player props ranked by hit rate, current streak and margin over benchmark lines. Game-by-game results for every pick, players on bye or ruled out excluded.`;
 return {title,description,alternates:{canonical:'/'},openGraph:{title,description,url:'/'}}; }
export default function Home(){ const w=currentWeek(); const rows=bestProps(18);
 return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebSite',name:SITE_NAME,url:SITE}}/>
  <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:`Best NFL player props Week ${w.week}`,itemListElement:rows.map((r,i)=>({'@type':'ListItem',position:i+1,name:`${r.name} ${r.prop}`,url:`${SITE}/players/${r.slug}`}))}}/>
  <div className="mb-4"><Search/></div>
  <h1>Best Props This Week: NFL Week {w.week}</h1>
  <p className="text-sm text-slate-400">The {rows.length} strongest player props for Week {w.week}, ranked from this season's game logs. Teams on bye{w.byes?.length?` (${w.byes.map(b=>b.toUpperCase()).join(', ')})`:''} and players listed Out are excluded. Lines are our standard benchmarks, not sportsbook lines.</p>
  <div className="mt-3"><BestProps rows={rows}/></div>
  <details className="card mt-4 text-xs text-slate-400"><summary className="cursor-pointer text-slate-200">How we rank</summary><p className="mt-2">{SCORE_NOTE} The "Why" line uses only these game logs, the supplied matchup report (team strengths and weaknesses) and the weather forecast feed.</p></details>
  <p className="mt-4 text-sm flex flex-wrap gap-3"><Link href="/matchups">All Week {w.week} matchups →</Link><Link href="/streaks">Prop search builder →</Link></p>
  <h2>Latest insights</h2><ul className="text-sm space-y-1">{(articles as any[]).filter(a=>a.kind!=='matchup').slice(0,6).map(a=><li key={a.slug}><Link href={`/insights/${a.slug}`}>{a.title}</Link></li>)}</ul>
 </>; }
