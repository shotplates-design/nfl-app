import { NextResponse } from 'next/server'; import bcrypt from 'bcryptjs'; import { authConfigured, redis, userKey } from '@/lib/auth';
export async function POST(req: Request){
  if(!authConfigured()) return NextResponse.json({error:'Accounts are not configured yet on this deployment.'},{status:503});
  const { email, password, name } = await req.json().catch(()=>({}));
  if(typeof email!=='string'||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({error:'Enter a valid email.'},{status:400});
  if(typeof password!=='string'||password.length<8) return NextResponse.json({error:'Password must be at least 8 characters.'},{status:400});
  const ok = await redis().set(userKey(email), { email:email.trim().toLowerCase(), name: String(name||'').slice(0,60), hash: await bcrypt.hash(password,10), created: Date.now() }, { nx:true });
  if(!ok) return NextResponse.json({error:'An account with that email already exists.'},{status:409});
  return NextResponse.json({ok:true});
}
