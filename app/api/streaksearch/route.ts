import { NextResponse } from 'next/server'; import { streakSearch } from '@/lib/streaksearch';
export const dynamic='force-dynamic';
export async function POST(req:Request){ const { q }=await req.json().catch(()=>({})); if(!q||typeof q!=='object') return NextResponse.json({error:'Bad query'},{status:400});
  const r=await streakSearch(q); return NextResponse.json(r,{status:r.signedIn?(r.locked?402:200):401,headers:{'cache-control':'private, no-store'}}); }
