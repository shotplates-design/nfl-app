import Link from 'next/link'; import { players, CAT_LABEL } from '@/lib/data'; import { Crumbs } from '@/lib/ui';
export const metadata={title:'All NFL Players – Stats & Game Logs',description:'Browse every NFL player in our database with game logs, season averages and streaks and hit rates.',alternates:{canonical:'/players'}};
export default function Page(){ const list=players.filter(p=>p.games.length).sort((a,b)=>a.name.localeCompare(b.name));
 return <><Crumbs items={[['Home','/'],['Players','/players']]}/><h1>All NFL Players</h1><p className="text-sm text-slate-400 mb-3">{list.length} players with game logs.</p>
 <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 text-sm">{list.map(p=><li key={p.slug}><Link href={`/players/${p.slug}`}>{p.name}</Link> <span className="text-slate-500 text-xs">{p.team.toUpperCase()} {p.cat&&CAT_LABEL[p.cat]}</span></li>)}</ul></>; }
