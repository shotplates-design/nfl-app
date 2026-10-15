import { NextResponse } from 'next/server'; import { viewerIsMember } from '@/lib/viewer'; import { betLinks, oddsEnabled } from '@/lib/odds';
export const dynamic = 'force-dynamic';
const NOTE = '21+ | Gamble responsibly';
// Members only. Free and signed-out callers are rejected here and in middleware; the response is links, never the API key.
export async function POST(req:Request){ if(!await viewerIsMember()) return NextResponse.json({error:'Membership required'},{status:402});
  if(!oddsEnabled()) return NextResponse.json({available:false, legs:[], parlay:[], note:NOTE});
  const body=await req.json().catch(()=>null); const legs=Array.isArray(body?.legs)?body.legs.slice(0,12):[];
  if(!legs.length) return NextResponse.json({error:'No legs'},{status:400});
  const clean=legs.map((l:any)=>({ name:String(l?.name||'').slice(0,80), stat:String(l?.stat||''), line:Number(l?.line), side:l?.side?String(l.side):undefined, team:l?.team?String(l.team).slice(0,8):undefined })).filter((l:any)=>l.name&&l.stat&&Number.isFinite(l.line));
  if(!clean.length) return NextResponse.json({error:'No legs'},{status:400});
  const data=await betLinks(clean); return NextResponse.json({...data, note:NOTE},{headers:{'cache-control':'private, no-store'}}); }
