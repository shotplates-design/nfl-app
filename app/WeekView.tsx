import { currentWeek, fmtKick, teamStreaks } from '@/lib/matchups'; import MatchupGrid from '@/components/MatchupGrid'; import Link from 'next/link';
const slim=(r:any)=>({slug:r.slug,name:r.name,label:r.label,streak:r.streak,hits:r.hits,games:r.games,strip:r.strip});
export default function WeekView(){ const w=currentWeek();
 const games=w.games.map(g=>{ const a=teamStreaks(g.awayCode).hot, h=teamStreaks(g.homeCode).hot;
  return {slug:g.slug,away:g.away,home:g.home,kick:fmtKick(g.kickoff),day:g.kickoff?new Date(g.kickoff).toLocaleDateString('en-US',{weekday:'long',timeZone:'America/New_York'}):'TBD',network:g.network,venue:g.venue,lean:g.analysis?.lean,heat:a.length+h.length,a:a.map(slim),h:h.map(slim)}; });
 return <section><h1>NFL Week {w.week} Matchups</h1><p className="text-sm text-slate-400 mb-3">{w.games.length} games · schedule from <a href={w.schedule_source} rel="nofollow noopener">NFL.com</a>{w.byes?.length?<> · Bye: {w.byes.map(b=>b.toUpperCase()).join(', ')}</>:null}. Tap a game to see every player on a streak.</p>
 <MatchupGrid games={games}/>
 <p className="text-xs text-slate-500 mt-3">No betting lines are shown; spreads/totals weren't in the supplied data. Thresholds are standard benchmarks. <Link href="/matchups/results">Past results →</Link></p></section>; }
