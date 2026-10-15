import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { getUser, isMember, stripeReady, isAdmin, hasFreeAccess } from '@/lib/member';
export const dynamic='force-dynamic';
export async function GET(){ const s=await getServerSession(authOptions); const email=s?.user?.email; const u=email?await getUser(email):null;
  return NextResponse.json({signedIn:!!email, member:hasFreeAccess(email)||isMember(u), free:!!u?.free, subStatus:u?.subStatus||null, canManage:!!u?.stripeCustomer, payments:stripeReady(), admin:isAdmin(email)},{headers:{'cache-control':'no-store'}}); }
