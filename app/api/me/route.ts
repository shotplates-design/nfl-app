import { NextResponse } from 'next/server'; import { cookies } from 'next/headers'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { redis } from '@/lib/auth'; import { getUser, isMember, stripeReady, isAdmin } from '@/lib/member';
export const dynamic='force-dynamic';
const FREE_LIMIT=5;
// Free lookups used by a non-member (display only; middleware.ts enforces the limit and verifies the cookie signature).
async function freeUsed(email?:string|null){ try{ if(email) return Number(await redis().scard(`free:${email.trim().toLowerCase()}`))||0;
  const d=cookies().get('tpp_free')?.value?.split('.')[0]; if(!d) return 0; const a=JSON.parse(Buffer.from(d,'base64url').toString()); return Array.isArray(a)?a.length:0; }catch{ return 0; } }
export async function GET(){ const s=await getServerSession(authOptions); const email=s?.user?.email; const u=email?await getUser(email):null; const member=isMember(u)||isAdmin(email);
  const freeLeft=member?null:Math.max(0,FREE_LIMIT-await freeUsed(email));
  return NextResponse.json({signedIn:!!email, member:isMember(u), free:!!u?.free, subStatus:u?.subStatus||null, canManage:!!u?.stripeCustomer, payments:stripeReady(), admin:isAdmin(email), freeLeft},{headers:{'cache-control':'no-store'}}); }
