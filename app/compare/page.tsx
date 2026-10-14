import Compare from './Compare'; import { Crumbs } from '@/lib/ui';
export const metadata={title:'Compare NFL Players – Side-by-Side Stats & Hit Rates',description:'Compare any two NFL players side by side: per-game averages and hit rates vs standard prop benchmarks.',alternates:{canonical:'/compare'}};
export default function P(){ return <><Crumbs items={[['Home','/'],['Compare','/compare']]}/><h1>Compare players</h1><Compare/></>; }
