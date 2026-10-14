import { NextResponse } from 'next/server'; import crypto from 'crypto'; import { authConfigured, redis, userKey } from '@/lib/auth'; import { sendMail } from '@/lib/mail';
const MSG='If that email has an account, we sent a password reset link. It expires in 1 hour.';
export async function POST(req:Request){ const { email } = await req.json().catch(()=>({})); const e=String(email||'').trim().toLowerCase();
  if(!authConfigured()||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return NextResponse.json({ok:true,message:MSG});
  const r=redis();
  // light throttle: one reset email per address per 2 minutes
  if(await r.get(userKey(e)) && await r.set(`pwreset-rl:${e}`,1,{nx:true,ex:120})){
    const token=crypto.randomBytes(32).toString('hex'); const hash=crypto.createHash('sha256').update(token).digest('hex');
    await r.set(`pwreset:${hash}`,e,{ex:3600});
    const base=(process.env.NEXT_PUBLIC_SITE_URL||'https://theplayerprops.com').replace(/\/$/,''); const link=`${base}/reset-password?token=${token}`;
    await sendMail(e,'Reset your ThePlayerProps password',`Reset your password (link expires in 1 hour): ${link}\n\nIf you didn't ask for this, ignore this email.`,
      `<p>Reset your ThePlayerProps password:</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 1 hour and works once. If you didn't ask for this, ignore this email.</p>`);
  }
  return NextResponse.json({ok:true,message:MSG}); }
