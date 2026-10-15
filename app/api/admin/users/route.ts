import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions, redis, userKey } from '@/lib/auth'; import { isAdmin } from '@/lib/member';
// Admin-only: delete a user's Redis records; cancel their Stripe subscription first if active.
export async function DELETE(req:Request){ const s=await getServerSession(authOptions); if(!isAdmin(s?.user?.email)) return NextResponse.json({error:'Not found'},{status:404});
  const { email } = await req.json().catch(()=>({})); const e=String(email||'').trim().toLowerCase(); if(!e) return NextResponse.json({error:'Email required'},{status:400});
  if(isAdmin(e)) return NextResponse.json({error:'You cannot remove your own account.'},{status:400});
  const r=redis(); const u=await r.get<any>(userKey(e)); if(!u) return NextResponse.json({error:'User not found'},{status:404});
  let canceled=false;
  if(u.stripeSub && ['active','trialing','past_due'].includes(u.subStatus) && process.env.STRIPE_SECRET_KEY){
    const c=await fetch(`https://api.stripe.com/v1/subscriptions/${u.stripeSub}`,{method:'DELETE',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`}});
    if(!c.ok){ const j=await c.json().catch(()=>({})); return NextResponse.json({error:`Stripe cancel failed: ${j?.error?.message||c.status}; user not removed.`},{status:502}); } canceled=true; }
  await r.del(userKey(e), `favs:${e}`, `favstreaks:${e}`, ...(u.stripeCustomer?[`stripecust:${u.stripeCustomer}`]:[]));
  return NextResponse.json({ok:true,canceled}); }
