import { NextResponse } from 'next/server'; import { cookies, headers } from 'next/headers'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { redis } from '@/lib/auth'; import { getUser, isMember, stripeReady, isAdmin } from '@/lib/member';
export const dynamic='force-dynamic';
const FREE_LIMIT=5;
// Free lookups used by a non-member (display only; middleware.ts enforces the limit and verifies the cookie signature).
async function freeUsed(email?:string|null){ try{ if(email) return Number(await redis().scard(`free:${email.trim().toLowerCase()}`))||0;
  const h=headers(); const ip=(h.get('x-forwarded-for')?.split(',')[0]||h.get('x-real-ip')||'unknown').trim();
  const n=Number(await redis().scard(`freeip:${ip}`))||0; let c=0;
  try{ const d=cookies().get('tpp_free')?.value?.split('.')[0]; if(d){ const a=JSON.parse(Buffer.from(d,'base64url').toString()); c=Array.isArray(a)?a.length:0; } }catch{}
  return Math.max(n,c); }catch{ return 0; } }
export async function GET(){ const s=await getServerSession(authOptions); const email=s?.user?.email; const u=email?await getUser(email):null; const member=isMember(u)||isAdmin(email);
  const freeLeft=member?null:Math.max(0,FREE_LIMIT-await freeUsed(email));
  return NextResponse.json({signedIn:!!email, member:isMember(u), free:!!u?.free, subStatus:u?.subStatus||null, canManage:!!u?.stripeCustomer, payments:stripeReady(), admin:isAdmin(email), freeLeft},{headers:{'cache-control':'no-store'}}); }
