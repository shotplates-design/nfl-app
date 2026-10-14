import Link from 'next/link'; import { allStreaks, GROUPS, SITE } from '@/lib/data'; import { Crumbs, JsonLd, StreakTable, BENCH_NOTE } from '@/lib/ui';
export const metadata={title:'NFL Player Prop Streaks – Hot & Cold Streaks vs Benchmarks',description:'Which NFL players are on active streaks? Consecutive games hitting 250+ pass yds, 75+ rush/rec yds, 5+ tackles and more, with hit rates and game-by-game results.',alternates:{canonical:'/streaks'}};
export default function Page(){ const s=allStreaks();
 return <><Crumbs items={[['Home','/'],['Streaks','/streaks']]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'CollectionPage',name:'NFL Player Prop Streaks',url:`${SITE}/streaks`,hasPart:Object.keys(GROUPS).map(g=>({'@type':'WebPage',name:`${GROUPS[g].label} streaks`,url:`${SITE}/streaks/${g}`}))}}/>
 <h1>NFL Player Streaks</h1><p className="text-sm text-slate-400">Active streaks of 3+ consecutive games hitting (🔥) or missing (🧊) a benchmark. {BENCH_NOTE}</p>
 <nav className="flex flex-wrap gap-2 my-4 text-sm">{Object.entries(GROUPS).map(([g,d]:any)=><Link key={g} href={`/streaks/${g}`} className="card !p-2">{d.label} streaks ({s.hot.filter(r=>r.group===g).length} 🔥 / {s.cold.filter(r=>r.group===g).length} 🧊)</Link>)}</nav>
 <h2>🔥 Longest active hot streaks</h2><StreakTable rows={s.hot.slice(0,25)}/>
 <h2>🧊 Longest active cold streaks</h2><p className="text-xs text-slate-500 mb-2">Only players who hit that benchmark at least once this season.</p><StreakTable rows={s.cold.slice(0,25)}/></>; }
