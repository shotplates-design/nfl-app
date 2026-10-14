import Link from 'next/link'; import { SITE_NAME } from '@/lib/data';
// Public marketing home shown at "/" to visitors without a membership (middleware rewrite). Contains no player/prop data.
export const metadata={title:`${SITE_NAME}: NFL Player Props, Hit Rates & Streaks`,description:'Weekly NFL player props ranked by hit rate, streaks and matchups, plus sleepers, a prop search builder and line explorer. $4.99/month.',alternates:{canonical:'/'}};
export default function Welcome(){ return <div className="max-w-lg mx-auto space-y-4 py-4">
  <h1>NFL player props, ranked by the numbers</h1>
  <p className="text-slate-300">Every week we rank the strongest player props from this season's game logs: hit rates against benchmark lines, current streaks, recent form and matchup context.</p>
  <ul className="card text-sm space-y-1 list-disc pl-6"><li>Best Props This Week, ranked with a transparent score</li><li>Under-the-radar Sleepers</li><li>Prop search builder and line explorer for any player</li><li>Matchups with weather and injuries, streaks, leaders, dashboard, watchlist and compare</li></ul>
  <Link href="/signup" className="block text-center rounded-lg bg-emerald-600 py-2 font-semibold text-white no-underline">Get full access – $4.99/month</Link>
  <p className="text-sm text-slate-400 text-center">Already a member? <Link href="/login">Log in</Link></p></div>; }
