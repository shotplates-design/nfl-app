import { NextResponse } from 'next/server';
import { viewerIsMember } from '@/lib/viewer';
import { offersForSlugs } from '@/lib/odds';
export const dynamic = 'force-dynamic';
// Members only. Resolves one bet leg per saved player (DraftKings line when we have it, otherwise their best streak).
export async function POST(req: Request) {
  if (!await viewerIsMember()) return NextResponse.json({ error: 'Membership required' }, { status: 402 });
  const body = await req.json().catch(() => null);
  const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s: unknown) => typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s)).slice(0, 40) : [];
  const offers = await offersForSlugs(slugs);
  return NextResponse.json({ offers }, { headers: { 'cache-control': 'private, no-store' } });
}
