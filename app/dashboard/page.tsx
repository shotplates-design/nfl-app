import { getServerSession } from 'next-auth'; import { redirect } from 'next/navigation'; import { authOptions } from '@/lib/auth'; import { allStreaks } from '@/lib/data'; import { BENCH_NOTE } from '@/lib/ui'; import StreakExplorer from '@/components/StreakExplorer'; import Gate from '@/components/Gate'; import SignOut from '../SignOut'; import { viewerIsMember } from '@/lib/viewer'; import { oddsEnabled } from '@/lib/odds';
export const metadata={title:'Dashboard – Hot Players',robots:{index:false}}; export const dynamic='force-dynamic';
const OFF=['passing','rushing','receiving','kicking'];
// one row per player: their best active hot streak (longest, then highest benchmark, then hit rate)
const best=(rows:any[])=>{const m=new Map();for(const r of rows) if(!m.has(r.slug)) m.set(r.slug,r);return [...m.values()];};
export default async function Dash({searchParams}:{searchParams:{tab?:string}}){ const s=await getServerSession(authOptions); if(!s) redirect('/login');
 const tab=searchParams.tab==='defense'?'defense':'offense'; const hot=allStreaks().hot;
 const rows=best(hot.filter(r=>tab==='defense'?!OFF.includes(r.group):OFF.includes(r.group)).sort((a,b)=>b.streak-a.streak||b.hits/b.games-a.hits/a.games||b.thr-a.thr)); const bet=(await viewerIsMember())&&oddsEnabled();
 const t=(k:string,l:string)=><a href={`/dashboard?tab=${k}`} className={`px-4 py-2 rounded-lg ${tab===k?'bg-emerald-600 text-white':'bg-slate-800 text-slate-300'} no-underline`}>{l}</a>;
 return <><div className="flex justify-between items-center"><h1>🔥 Hot Players</h1><SignOut/></div><p className="text-sm text-slate-400 mb-3">Welcome{s.user?.name?`, ${s.user.name}`:''}. Each player's best active streak (3+ straight games) vs standard benchmarks. {BENCH_NOTE}</p>
 <div className="flex gap-2 mb-4">{t('offense','Offensive')}{t('defense','Defensive')}</div><Gate label="The dashboard"><StreakExplorer rows={rows} groups={tab==='defense'?['defense']:OFF} showMode={false} limit={50} bet={bet}/></Gate></>; }
