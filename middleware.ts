import { NextResponse, type NextRequest } from 'next/server'; import { getToken } from 'next-auth/jwt';
// Server-side paywall. Every page, RSC payload, data JSON and API not listed as public requires a signed-in member
// (active/trialing Stripe subscription, promo 'free' flag, or the admin account). Membership is read from Upstash Redis on each gated request.
const ADMIN='drosser1724@yahoo.com';
const PUBLIC_PAGES=new Set(['/welcome','/signup','/login','/subscribe','/forgot-password','/reset-password','/robots.txt','/sitemap.xml','/manifest.webmanifest','/opengraph-image']);
const PUBLIC_API=['/api/auth','/api/signup','/api/me','/api/promo','/api/stripe','/api/password'];
const SIGNED_IN_OK=['/account','/api/account']; // any signed-in user, member or not
const RURL=()=>process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL; const RTOK=()=>process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
async function member(email:string){ if(email===ADMIN) return true; if(!RURL()||!RTOK()) return false;
  try{ const r=await fetch(`${RURL()}/get/${encodeURIComponent('user:'+email)}`,{headers:{Authorization:`Bearer ${RTOK()}`},cache:'no-store'}); if(!r.ok) return false;
    const {result}=await r.json(); const u=typeof result==='string'?JSON.parse(result):result; return !!u&&(u.free===true||['active','trialing'].includes(u.subStatus)); }catch{ return false; } }
const starts=(p:string,l:string[])=>l.some(x=>p===x||p.startsWith(x+'/'));
export async function middleware(req:NextRequest){ const p=req.nextUrl.pathname;
  if(PUBLIC_PAGES.has(p)||starts(p,PUBLIC_API)) return NextResponse.next();
  const tok=await getToken({req,secret:process.env.NEXTAUTH_SECRET}); const email=(tok?.email||'').toString().trim().toLowerCase();
  if(email&&starts(p,SIGNED_IN_OK)) return NextResponse.next();
  const ok=!!email&&await member(email);
  if(ok){ const res=NextResponse.next(); res.headers.set('Cache-Control','private, no-store'); return res; }
  if(p==='/') return NextResponse.rewrite(new URL('/welcome',req.url)); // public marketing home, no data
  if(p.startsWith('/api/')||p.endsWith('.json')) return NextResponse.json({error:email?'Membership required':'Sign in required'},{status:email?402:401});
  const u=req.nextUrl.clone(); u.search=''; if(email){ u.pathname='/subscribe'; } else { u.pathname='/login'; u.searchParams.set('callbackUrl',p); } return NextResponse.redirect(u); }
// Skip Next internals and static image/icon assets; everything else (pages, /api, *.json data files) goes through the check.
export const config={ matcher:['/((?!_next/static|_next/image|favicon|icon|apple-touch-icon|logo\\.svg|.*\\.(?:png|svg|ico|webp|jpg)$).*)'] };
