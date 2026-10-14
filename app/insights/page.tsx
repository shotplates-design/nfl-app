import Link from 'next/link'; import articles from '@/data/articles.json'; import { Crumbs } from '@/lib/ui';
export const metadata={title:'NFL Betting Insights – Player Streaks & Matchups',description:'Auto-updated NFL insights: player streaks, top performances and matchup stat breakdowns.',alternates:{canonical:'/insights'}};
export default function Page(){ const a=articles as any[]; return <><Crumbs items={[['Home','/'],['Insights','/insights']]}/><h1>NFL Betting Insights</h1>
 <h2>Streaks & top performances</h2><ul className="text-sm space-y-1">{a.filter(x=>x.kind!=='matchup').map(x=><li key={x.slug}><Link href={`/insights/${x.slug}`}>{x.title}</Link></li>)}</ul>
 <h2>Matchup breakdowns</h2><ul className="text-sm space-y-1">{a.filter(x=>x.kind==='matchup').map(x=><li key={x.slug}><Link href={`/insights/${x.slug}`}>{x.title}</Link></li>)}</ul></>; }
