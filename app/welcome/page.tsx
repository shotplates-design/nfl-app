import Link from 'next/link'; import { SITE_NAME } from '@/lib/data'; import { bestProps } from '@/lib/bestprops'; import { currentWeek } from '@/lib/matchups'; import BestProps from '@/components/BestProps'; import { allStreaks } from '@/lib/data'; import { StreakTable } from '@/lib/ui'; import Search from '../Search';
// Public home shown at "/" to visitors without a membership (middleware rewrite). Same look as the member home, but the HTML carries ONLY the top 3
// Best Props (fields the card needs, no player/matchup links, no watchlist); the locked section uses dummy rows, not real data.
export const metadata={title:`${SITE_NAME}: NFL Player Props, Hit Rates & Streaks`,description:'Weekly NFL player props ranked by hit rate, streaks and matchups, plus a prop search builder. Sign up for full access.',alternates:{canonical:'/'}};
const PICK=['name','team','role','at','oppName','kick','prop','bench','hits','games','streak','avg','thr','score','strip','why'];
const DUMMY=Array.from({length:4},()=>({name:'Player Name',team:'',role:'WR',at:'vs',oppName:'Opponent',kick:'Sun 1:00 PM',prop:'Over 00.5 Yds',bench:'00.5',hits:0,games:5,streak:0,avg:0,thr:1,score:0,
  strip:Array.from({length:5},()=>({h:true,v:0,v2:0})),why:'Locked. Members see every ranked prop with the full reasoning.'}));
const SPICK=['slug','key','name','team','label','hot','streak','hits','games','strip'];
const SDUMMY=Array.from({length:5},(_,i)=>({slug:'locked',key:String(i),name:'Player Name',team:'xxx',label:'Over 00.5 Yds',hot:true,streak:0,hits:0,games:5,strip:Array.from({length:5},()=>({h:true,d:'',o:'',v:0}))}));
const Lock=({title}:{title:string})=><div className="absolute inset-0 flex items-start justify-center pt-8 bg-gradient-to-b from-slate-950/40 to-slate-950/90"><div className="card max-w-xs text-center space-y-2"><p className="font-semibold text-white">🔒 {title}</p>
    <p className="text-sm text-slate-400">Free account: streaks, prop search builder, unlimited player pages, teams, matchups, leaders, insights and the top 3 Best Props.</p>
    <Link href="/signup" className="block rounded-lg bg-emerald-600 py-2 font-semibold text-white no-underline">Sign up for full access</Link><p className="text-xs text-slate-500">Have an account? <Link href="/login">Log in</Link></p></div></div>;
export default function Welcome(){ const streaks=allStreaks().hot.filter((r,i,a)=>a.findIndex(x=>x.slug===r.slug)===i).slice(0,3).map((r:any)=>Object.fromEntries(SPICK.map(k=>[k,r[k]]))); const w=currentWeek(); const all=bestProps(18);
 const top=all.slice(0,3).map(r=>Object.fromEntries(PICK.map(k=>[k,(r as any)[k]])));
 return <>
  <div className="mb-4"><Search/></div>
  <div className="card mb-4 text-sm"><p className="font-semibold text-white">Sign up for full access</p><p className="text-slate-400">Free account: streaks, prop search builder, unlimited player pages, teams, matchups, leaders, insights and the top 3 Best Props. Membership adds the full Best Props board, line explorer, Sleepers, watchlist, compare and dashboard.</p><a href="/signup" className="mt-2 inline-block rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white no-underline">Sign up for full access</a></div>
  <h1>Best Props This Week: NFL Week {w.week}</h1>
  <p className="text-sm text-slate-400">The {all.length} strongest player props for Week {w.week}, ranked from this season's game logs. Teams on bye{w.byes?.length?` (${w.byes.map(b=>b.toUpperCase()).join(', ')})`:''} and players listed Out are excluded. Each line is set from the player's own game logs (the highest number he clears in 80%+ of games), not a sportsbook line.</p>
  <div className="mt-3"><BestProps rows={top} preview/></div>
  <div className="relative mt-3"><div aria-hidden="true" className="blur-sm pointer-events-none select-none max-h-[520px] overflow-hidden" {...{inert:''} as any}><BestProps rows={DUMMY} start={4} preview/></div><Lock title="Sign up for full access"/></div>
  <h2>Top active streaks</h2><StreakTable rows={streaks} preview/>
  <div className="relative mt-2"><div aria-hidden="true" className="blur-sm pointer-events-none select-none overflow-hidden" {...{inert:''} as any}><StreakTable rows={SDUMMY} preview nolink/></div><Lock title="Sign up for full access"/></div>
 </>; }
