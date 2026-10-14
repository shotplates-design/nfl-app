import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { stripe, stripeReady } from '@/lib/member';
export async function POST(req:Request){ const s=await getServerSession(authOptions); if(!s?.user?.email) return NextResponse.json({error:'Sign in first.'},{status:401});
  if(!stripeReady()) return NextResponse.json({error:'Payments coming soon.',comingSoon:true},{status:503});
  const origin=new URL(req.url).origin; const email=s.user.email.trim().toLowerCase();
  const cs=await stripe('checkout/sessions',{mode:'subscription','line_items[0][price]':process.env.STRIPE_PRICE_ID!,'line_items[0][quantity]':'1',customer_email:email,client_reference_id:email,success_url:`${origin}/subscribe?status=success`,cancel_url:`${origin}/subscribe?status=cancel`,allow_promotion_codes:'false'});
  return NextResponse.json({url:cs.url}); }
