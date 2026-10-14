import { NextResponse } from 'next/server'; import crypto from 'crypto'; import bcrypt from 'bcryptjs'; import { authConfigured, redis, userKey } from '@/lib/auth';
export async function POST(req:Request){ const { token, password } = await req.json().catch(()=>({}));
  if(!authConfigured()) return NextResponse.json({error:'Accounts are not configured.'},{status:503});
  if(typeof password!=='string'||password.length<8) return NextResponse.json({error:'Password must be at least 8 characters.'},{status:400});
  const r=redis(); const k=`pwreset:${crypto.createHash('sha256').update(String(token||'')).digest('hex')}`;
  const email=await r.getdel<string>(k); // single use
  if(!email) return NextResponse.json({error:'This reset link is invalid or has expired. Request a new one.'},{status:400});
  const u=await r.get<any>(userKey(email)); if(!u) return NextResponse.json({error:'This reset link is invalid or has expired.'},{status:400});
  await r.set(userKey(email),{...u,hash:await bcrypt.hash(password,10),pwChanged:Date.now()}); return NextResponse.json({ok:true}); }
