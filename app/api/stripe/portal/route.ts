import { NextResponse } from 'next/server'; import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { getUser, stripe } from '@/lib/member';
export async function POST(req:Request){ const s=await getServerSession(authOptions); const u=s?.user?.email?await getUser(s.user.email):null;
  if(!u?.stripeCustomer||!process.env.STRIPE_SECRET_KEY) return NextResponse.json({error:'No billing account yet.'},{status:400});
  const p=await stripe('billing_portal/sessions',{customer:u.stripeCustomer,return_url:`${new URL(req.url).origin}/subscribe`}); return NextResponse.json({url:p.url}); }
