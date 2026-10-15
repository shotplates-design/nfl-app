import Link from 'next/link'; import { Crumbs, JsonLd } from '@/lib/ui'; import { SITE } from '@/lib/data'; import { currentWeek } from '@/lib/matchups'; import { sleepers, SLEEPER_NOTE } from '@/lib/bestprops'; import Gate from '@/components/Gate'; import BestProps from '@/components/BestProps'; import { viewerIsMember } from '@/lib/viewer'; import { oddsEnabled } from '@/lib/odds';
export const dynamic='force-dynamic';
export function generateMetadata(){ const w=currentWeek(); const title=`NFL Week ${w.week} Sleepers: Under-the-Radar Player Props & Value Picks`;
 const description=`Non-star NFL players putting up numbers before Week ${w.week}: rising usage, high hit rates on meaningful lines, and favorable matchups, all from game logs.`;
 return {title,description,alternates:{canonical:'/sleepers'},openGraph:{title,description,url:'/sleepers'}}; }
export default async function Page(){ const w=currentWeek(); const {pick}=sleepers(15); const bet=(await viewerIsMember())&&oddsEnabled();
 return <><Crumbs items={[['Home','/'],['Sleepers','/sleepers']]}/>
  <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:`NFL Week ${w.week} sleepers`,url:`${SITE}/sleepers`,itemListElement:pick.map((r,i)=>({'@type':'ListItem',position:i+1,name:`${r.name} ${r.prop}`,url:`${SITE}/players/${r.slug}`}))}}/>
  <h1>Under-the-Radar Value: Week {w.week} Sleepers</h1>
  <p className="text-sm text-slate-400">Players outside the big names at their position who keep producing, ranked by hit rate, line difficulty, recent trend and this week's opponent. Lines are set from each player's game logs, not sportsbooks.</p>
  <div className="mt-3"><BestProps rows={pick.slice(0,2)} bet={bet}/>{bet&&<p className="text-[10px] text-slate-500 mt-2">21+ | Gamble responsibly</p>}</div><div className="mt-3"><Gate label="The full Sleepers list"><BestProps rows={pick.slice(2)} start={3} bet={bet}/></Gate></div>
  <details className="card mt-4 text-xs text-slate-400"><summary className="cursor-pointer text-slate-200">How we pick sleepers</summary><p className="mt-2">{SLEEPER_NOTE}</p></details>
  <p className="mt-4 text-sm"><Link href="/">← Best props this week</Link></p></>; }
