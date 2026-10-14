import Link from 'next/link'; import { CAT_STATS, CAT_LABEL } from '@/lib/data'; import { Crumbs } from '@/lib/ui';
export const metadata={title:'NFL Stat Leaderboards',description:'NFL leaderboards for passing, rushing, receiving, defense, kicking and punting – totals and per-game averages.',alternates:{canonical:'/leaders'}};
export default function Page(){ return <><Crumbs items={[['Home','/'],['Leaders','/leaders']]}/><h1>NFL Stat Leaderboards</h1>
 <ul className="grid sm:grid-cols-2 gap-2">{Object.keys(CAT_STATS).map(c=><li key={c}><Link href={`/leaders/${c}`} className="card block">{CAT_LABEL[c]} leaders</Link></li>)}</ul></>; }
