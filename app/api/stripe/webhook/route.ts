import { NextResponse } from 'next/server'; import crypto from 'crypto'; import { redis } from '@/lib/auth'; import { updateUser, updateByCustomer } from '@/lib/member';
export const runtime='nodejs';
// Verifies the Stripe-Signature header (v1 HMAC-SHA256 of `${t}.${body}`) with STRIPE_WEBHOOK_SECRET, 5-minute tolerance.
function verify(body:string, header:string|null, secret:string){ if(!header) return false; const parts=Object.fromEntries(header.split(',').map(x=>x.split('=') as [string,string])) as any;
  const sigs=header.split(',').filter(x=>x.startsWith('v1=')).map(x=>x.slice(3)); const t=parts.t; if(!t||Math.abs(Date.now()/1000-+t)>300) return false;
  const exp=crypto.createHmac('sha256',secret).update(`${t}.${body}`).digest('hex');
  return sigs.some(s=>s.length===exp.length&&crypto.timingSafeEqual(Buffer.from(s),Buffer.from(exp))); }
export async function POST(req:Request){ const secret=process.env.STRIPE_WEBHOOK_SECRET; if(!secret) return NextResponse.json({error:'Webhook not configured'},{status:503});
  const body=await req.text(); if(!verify(body,req.headers.get('stripe-signature'),secret)) return NextResponse.json({error:'Bad signature'},{status:400});
  const ev=JSON.parse(body); const o=ev.data?.object||{};
  if(ev.type==='checkout.session.completed'&&o.mode==='subscription'){ const email=String(o.client_reference_id||o.customer_email||'').toLowerCase();
    if(email&&o.customer){ await redis().set(`stripecust:${o.customer}`,email); await updateUser(email,{stripeCustomer:o.customer,stripeSub:o.subscription,subStatus:'active'}); } }
  else if(ev.type==='customer.subscription.updated') await updateByCustomer(o.customer,{stripeSub:o.id,subStatus:o.status});
  else if(ev.type==='customer.subscription.deleted') await updateByCustomer(o.customer,{subStatus:'canceled'});
  return NextResponse.json({received:true}); }
