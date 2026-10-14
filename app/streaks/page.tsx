import Link from 'next/link'; import { allStreaks, SITE } from '@/lib/data'; import { Crumbs, JsonLd, StreakTable, BENCH_NOTE } from '@/lib/ui'; import Gate from '@/components/Gate'; import PropBuilder from '@/components/PropBuilder'; import { POPULAR } from '@/lib/props.mjs';
export const metadata={title:'NFL Prop Streaks & Prop Search Builder – Hit Rates by Game',description:'Search every NFL player by stat, position and your own over/under line: who has gone over in every game, in their last N games, or on an active streak. Top 10 active prop streaks updated from game logs.',alternates:{canonical:'/streaks'}};
export default function Page(){ const top=allStreaks().hot.filter((r,i,a)=>a.findIndex(x=>x.slug===r.slug)===i).slice(0,10);
 return <><Crumbs items={[['Home','/'],['Streaks','/streaks']]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'CollectionPage',name:'NFL Prop Streaks',url:`${SITE}/streaks`,hasPart:POPULAR.map(p=>({'@type':'WebPage',name:p.title,url:`${SITE}/streaks/q/${p.slug}`}))}}/>
 <h1>NFL Prop Streaks</h1><p className="text-sm text-slate-400">Find players who keep clearing a number. Pick a stat, a position and any over/under line, then choose a scope: every game this season, the last N games, or an active streak. Every result comes from this season's game logs. {BENCH_NOTE}</p>
 <h2>Top 10 active streaks</h2><StreakTable rows={top}/>
 <div className="mt-6"><Gate label="Prop search"><PropBuilder/></Gate></div>
 <h2>Popular searches</h2><ul className="grid sm:grid-cols-2 gap-2 text-sm">{POPULAR.map(p=><li key={p.slug}><Link href={`/streaks/q/${p.slug}`} className="card block !p-2">{p.title}</Link></li>)}</ul>
</>; }
