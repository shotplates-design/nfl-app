import SignedOut from '@/components/SignedOut';
import Gate from '@/components/Gate';
import Watchlist from './Watchlist';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Watchlist', robots: { index: false }, alternates: { canonical: '/watchlist' } };
export default function P() {
  return <><h1>★ Watchlist</h1><p className="text-sm text-slate-400 mb-3">Saved on this device<SignedOut>; synced to your account when you're <Link href="/login">logged in</Link></SignedOut>.</p><Gate label="Watchlist"><Watchlist/></Gate></>;
}
