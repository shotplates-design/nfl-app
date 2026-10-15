import { redis, userKey, authConfigured } from '@/lib/auth';
// Member = active Stripe subscription or promo free access. Stored on the user record in Redis:
// { free?: true, promo?: string, subStatus?: 'active'|'trialing'|'past_due'|'canceled'|..., stripeCustomer?: string, stripeSub?: string }
export const PROMO_CODES = ['rosser']; // case-insensitive; grants full free access
export async function getUser(email:string){ if(!authConfigured()) return null; return await redis().get<any>(userKey(email)); }
export async function updateUser(email:string, patch:Record<string,any>){ const r=redis(); const k=userKey(email); const u=await r.get<any>(k); if(!u) return null; const n={...u,...patch}; await r.set(k,n); return n; }
export async function updateByCustomer(customer:string, patch:Record<string,any>){ const r=redis(); const email=await r.get<string>(`stripecust:${customer}`); return email ? updateUser(email,patch) : null; }
export const stripeReady = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
export async function stripe(path:string, params:Record<string,string>){ // minimal Stripe REST client (no SDK)
  const r=await fetch(`https://api.stripe.com/v1/${path}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const j=await r.json(); if(!r.ok) throw new Error(j?.error?.message||'Stripe error'); return j; }
export const ADMIN_EMAIL = 'drosser1724@yahoo.com';
export const FREE_ACCESS_EMAILS = ['nnoroozi11@gmail.com']; // case-insensitive; full member access, not admin
export const hasFreeAccess = (email?:string|null) => !!email && FREE_ACCESS_EMAILS.includes(email.trim().toLowerCase());
export const isAdmin = (email?:string|null) => !!email && email.trim().toLowerCase()===ADMIN_EMAIL;
export const isMember = (u:any) => hasFreeAccess(typeof u==='string'?u:u?.email) || (!!u && typeof u==='object' && (u.free===true || ['active','trialing'].includes(u.subStatus) || (typeof u.freeUntil==='number' && u.freeUntil>Date.now())));
