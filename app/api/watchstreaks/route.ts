import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, redis, authConfigured } from '@/lib/auth';
import { viewerIsMember } from '@/lib/viewer';
import { watchKey, asList, cleanList } from '@/lib/watchstreaks';

export const dynamic = 'force-dynamic';
const priv = { 'cache-control': 'private, no-store' };

// Members only (paid, promo, granted, or admin). Middleware also rejects free and signed-out callers.
async function gate() {
  const s = await getServerSession(authOptions);
  const email = authConfigured() && s?.user?.email ? s.user.email : null;
  if (!email) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  if (!await viewerIsMember()) return { error: NextResponse.json({ error: 'Membership required' }, { status: 402 }) };
  return { email };
}

export async function GET() {
  const g = await gate();
  if ('error' in g) return g.error;
  let raw: unknown = [];
  try { raw = await redis().get(watchKey(g.email)); } catch { raw = []; }
  return NextResponse.json({ items: asList(raw) }, { headers: priv });
}

export async function PUT(req: Request) {
  const g = await gate();
  if ('error' in g) return g.error;
  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body) ? body : body?.items;
  if (!Array.isArray(raw)) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const items = cleanList(raw);
  await redis().set(watchKey(g.email), items);
  return NextResponse.json({ ok: true, items }, { headers: priv });
}
