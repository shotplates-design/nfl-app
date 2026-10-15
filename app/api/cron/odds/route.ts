import { NextResponse } from 'next/server'; import { pullOdds } from '@/lib/odds';
export const dynamic = 'force-dynamic';
// Vercel Cron sends Authorization: Bearer $CRON_SECRET. No session. Middleware checks the same header.
export async function GET(req:Request){ const secret=(process.env as Record<string,string|undefined>)['CRON_SECRET'];
  if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({error:'Unauthorized'},{status:401});
  const result=await pullOdds(); return NextResponse.json(result, {headers:{'cache-control':'no-store'}}); }
