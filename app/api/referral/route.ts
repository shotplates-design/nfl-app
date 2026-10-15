import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { ensureRefCode, referralCount } from '@/lib/referral';
export async function GET(){ const s=await getServerSession(authOptions); const e=s?.user?.email; if(!e) return NextResponse.json({error:'Sign in required'},{status:401});
  const code=await ensureRefCode(e); return NextResponse.json({code,url:code?`https://theplayerprops.com/signup?ref=${code}`:null,count:await referralCount(e)}); }
