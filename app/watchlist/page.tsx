import Watchlist from './Watchlist'; import Link from 'next/link';
export const metadata={title:'My Watchlist',robots:{index:false},alternates:{canonical:'/watchlist'}};
export default function P(){ return <><h1>★ Watchlist</h1><p className="text-sm text-slate-400 mb-3">Saved on this device; synced to your account when you're <Link href="/login">logged in</Link>.</p><Watchlist/></>; }
