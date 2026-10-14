import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions, redis, userKey, authConfigured } from '@/lib/auth';
// Lets a signed-in user delete their own account.
export async function DELETE(){ const s=await getServerSession(authOptions);
  if(!authConfigured()||!s?.user?.email) return NextResponse.json({error:'Not signed in'},{status:401});
  await redis().del(userKey(s.user.email), `favs:${s.user.email.trim().toLowerCase()}`); return NextResponse.json({ok:true}); }
