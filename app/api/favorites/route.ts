import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions, redis, authConfigured } from '@/lib/auth';
const key=(e:string)=>`favs:${e.trim().toLowerCase()}`;
async function who(){ const s=await getServerSession(authOptions); return authConfigured()&&s?.user?.email? s.user.email : null; }
export async function GET(){ const e=await who(); if(!e) return NextResponse.json({},{status:401}); return NextResponse.json((await redis().get(key(e)))||{}); }
export async function PUT(req:Request){ const e=await who(); if(!e) return NextResponse.json({error:'Not signed in'},{status:401});
  const body=await req.json().catch(()=>null); if(!body||typeof body!=='object'||Array.isArray(body)) return NextResponse.json({error:'Bad body'},{status:400});
  const clean:Record<string,string>={}; for(const [k,v] of Object.entries(body).slice(0,200)) if(/^[a-z0-9-]{1,80}$/.test(k)) clean[k]=String(v).slice(0,80);
  await redis().set(key(e),clean); return NextResponse.json({ok:true,count:Object.keys(clean).length}); }
