import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { PROMO_CODES, updateUser } from '@/lib/member';
export async function POST(req:Request){ const s=await getServerSession(authOptions); if(!s?.user?.email) return NextResponse.json({error:'Sign in first.'},{status:401});
  const { code } = await req.json().catch(()=>({})); const c=String(code||'').trim().toLowerCase();
  if(!PROMO_CODES.includes(c)) return NextResponse.json({error:'That promo code is not valid.'},{status:400});
  await updateUser(s.user.email,{free:true,promo:c}); return NextResponse.json({ok:true}); }
