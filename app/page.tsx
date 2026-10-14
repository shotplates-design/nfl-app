import Link from 'next/link'; import Search from './Search'; import WeekView from './WeekView'; import { allStreaks, GROUPS, players } from '@/lib/data'; import { StreakTable, BENCH_NOTE } from '@/lib/ui'; import articles from '@/data/articles.json'; import { JsonLd } from '@/lib/ui'; import { SITE, SITE_NAME } from '@/lib/data';
export default function Home(){ 
 return <>
  <JsonLd data={{'@context':'https://schema.org','@type':'WebSite',name:SITE_NAME,url:SITE}}/>
  <div className="mb-4"><Search/></div>
  <WeekView/>
  <h2>🔥 Active hot streaks</h2><p className="text-xs text-slate-500 mb-2">{BENCH_NOTE}</p>
  <StreakTable rows={allStreaks().hot.slice(0,10)}/>
  <h2>🧊 Active cold streaks</h2><StreakTable rows={allStreaks().cold.slice(0,5)}/>
  <p className="mt-3 text-sm flex flex-wrap gap-3"><Link href="/streaks">All streaks →</Link>{Object.entries(GROUPS).map(([g,d]:any)=><Link key={g} href={`/streaks/${g}`}>{d.label}</Link>)}</p>
  <h2>Latest insights</h2><ul className="text-sm space-y-1">{(articles as any[]).filter(a=>a.kind!=='matchup').slice(0,8).map(a=><li key={a.slug}><Link href={`/insights/${a.slug}`}>{a.title}</Link></li>)}</ul>
 </>; }
