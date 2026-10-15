import SignedOut from '@/components/SignedOut';
import Gate from '@/components/Gate';
import Watchlist from './Watchlist';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions, redis } from '@/lib/auth';
import { viewerIsMember } from '@/lib/viewer';
import { offersForSlugs, type WatchOffer } from '@/lib/odds';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Watchlist', robots: { index: false }, alternates: { canonical: '/watchlist' } };
export default async function P() {
  const member = await viewerIsMember();
  let offers: Record<string, WatchOffer> = {};
  if (member) {
    const s = await getServerSession(authOptions);
    const email = s?.user?.email?.trim().toLowerCase();
    if (email) {
      const favs = (await redis().get<Record<string, string>>(`favs:${email}`)) || {};
      offers = await offersForSlugs(Object.keys(favs));
    }
  }
  return <><h1>★ Watchlist</h1><p className="text-sm text-slate-400 mb-3">Saved on this device<SignedOut>; synced to your account when you're <Link href="/login">logged in</Link></SignedOut>.</p><Gate label="Watchlist"><Watchlist member={member} offers={offers}/></Gate></>;
}
