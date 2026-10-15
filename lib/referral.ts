import { redis, userKey } from '@/lib/auth'; import { REF_MONTH_MS } from '@/lib/member';
// Referral codes live in Upstash: refcode:<code> -> referrer email; user.refCode on the user record; referrals:<email> = set of referred emails.
// Each new signup through a referral link adds 1 free month (user.freeUntil, ms epoch), which isMember / middleware honor alongside Stripe + promo.
const gen=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('');
export async function ensureRefCode(email:string){ const r=redis(); const k=userKey(email); const u=await r.get<any>(k); if(!u) return null; if(u.refCode) return u.refCode as string;
  for(let i=0;i<5;i++){ const c=gen(); if(await r.set(`refcode:${c}`,u.email||email.trim().toLowerCase(),{nx:true})){ await r.set(k,{...u,refCode:c}); return c; } } return null; }
export async function referralCount(email:string){ try{ return Number(await redis().scard(`referrals:${email.trim().toLowerCase()}`))||0; }catch{ return 0; } }
export async function creditReferrer(code:string, newEmail:string){ const r=redis(); const c=code.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20); if(!c) return;
  const ref=await r.get<string>(`refcode:${c}`); if(!ref||ref===newEmail) return;
  if(!await r.sadd(`referrals:${ref}`,newEmail)) return; // each friend counts once
  const k=userKey(ref); const u=await r.get<any>(k); if(!u) return;
  const base=Math.max(Date.now(), typeof u.freeUntil==='number'?u.freeUntil:0); await r.set(k,{...u,freeUntil:base+REF_MONTH_MS});
  const nk=userKey(newEmail); const nu=await r.get<any>(nk); if(nu) await r.set(nk,{...nu,referredBy:ref}); }
