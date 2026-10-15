import SignedOut from '@/components/SignedOut'; import Gate from '@/components/Gate'; import Watchlist from './Watchlist'; import WatchStreaks from './WatchStreaks'; import Link from 'next/link';
import { getServerSession } from 'next-auth'; import { authOptions, redis } from '@/lib/auth'; import { viewerIsMember } from '@/lib/viewer'; import { oddsEnabled } from '@/lib/odds'; import { watchKey, liveRows } from '@/lib/watchstreaks';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Watchlist', robots: { index: false }, alternates: { canonical: '/watchlist' } };
export default async function P() {
  const member = await viewerIsMember();
  let rows: ReturnType<typeof liveRows> = [];
  if (member) {
    try {
      const s = await getServerSession(authOptions);
      const email = s?.user?.email;
      if (email) rows = liveRows(await redis().get(watchKey(email)));
    } catch { rows = []; }
  }
  const bet = member && oddsEnabled();
  return <>
    <h1>★ Watchlist</h1>
    {member && <section className="mb-8">
      <h2>Watched streaks</h2>
      <p className="text-sm text-slate-400 mb-3">Saved to your account. Hits and the current streak are recalculated from this season’s game logs.</p>
      <WatchStreaks rows={rows} bet={bet} />
    </section>}
    <h2>Players</h2>
    <p className="text-sm text-slate-400 mb-3">Saved on this device<SignedOut>; synced to your account when you're <Link href="/login">logged in</Link></SignedOut>.</p>
    <Gate label="Watchlist"><Watchlist /></Gate>
  </>;
}
