import { NextResponse } from 'next/server'; import bcrypt from 'bcryptjs'; import { getServerSession } from 'next-auth'; import { authOptions, authConfigured, redis, userKey } from '@/lib/auth';
export async function POST(req:Request){ const s=await getServerSession(authOptions); const email=s?.user?.email; if(!email||!authConfigured()) return NextResponse.json({error:'Please log in again.'},{status:401});
  const { current, next } = await req.json().catch(()=>({}));
  if(typeof next!=='string'||next.length<8) return NextResponse.json({error:'New password must be at least 8 characters.'},{status:400});
  const r=redis(); const k=userKey(email); const u=await r.get<any>(k);
  if(!u||typeof current!=='string'||!(await bcrypt.compare(current,u.hash))) return NextResponse.json({error:'Current password is incorrect.'},{status:400});
  await r.set(k,{...u,hash:await bcrypt.hash(next,10)}); return NextResponse.json({ok:true}); }
