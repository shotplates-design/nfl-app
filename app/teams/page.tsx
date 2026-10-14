import Link from 'next/link'; import { teamCodes, teamName } from '@/lib/data'; import { Crumbs } from '@/lib/ui';
export const metadata={title:'NFL Teams – Player Stats by Team',description:'Pick an NFL team to see every player\'s stats, game logs and recent streaks.',alternates:{canonical:'/teams'}};
export default function Page(){ return <><Crumbs items={[['Home','/'],['Teams','/teams']]}/><h1>NFL Teams</h1>
 <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">{teamCodes().map(t=><li key={t}><Link href={`/teams/${t}`} className="card block !p-3 text-sm">{teamName(t)}</Link></li>)}</ul></>; }
