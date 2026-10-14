import { players, teamCodes } from '@/lib/data'; import { Crumbs } from '@/lib/ui'; import PlayerSearch from './PlayerSearch';
export const metadata={title:'All NFL Players – Search Stats & Game Logs',description:'Search every NFL player in our database by name, team and position: game logs, season averages, streaks and hit rates.',alternates:{canonical:'/players'}};
export default function Page(){ const list=players.filter(p=>p.games.length).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>[p.slug,p.name,p.team,p.cat||''] as [string,string,string,string]);
 return <><Crumbs items={[['Home','/'],['Players','/players']]}/><h1>NFL Players</h1><p className="text-sm text-slate-400 mb-3">{list.length} players with game logs. Type to filter instantly.</p>
 <PlayerSearch list={list} teams={teamCodes()}/></>; }
