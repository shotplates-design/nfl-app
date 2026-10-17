import { NextResponse, type NextRequest } from 'next/server'; import { getToken } from 'next-auth/jwt'; import { PLAYER_WEEK_LIMIT, PLAYER_WEEK_TTL, playerWeekKey } from '@/lib/limits'; import { isAdminEmail, isFreeAccessEmail } from '@/lib/accessEmails';
// Server-side gating. Signed-out visitors get only the public pages ('/' = welcome preview). Any signed-in account (free, no card)
// gets the FREE paths; everything else needs a member (active/trialing Stripe subscription, promo 'free' flag, an always-granted email, or the admin account). Membership is read from Upstash Redis on each gated request.
// Admin and free-access lists come from env ADMIN_EMAILS / FREE_ACCESS_EMAILS (lib/accessEmails.ts).
const PUBLIC_PAGES=new Set(['/welcome','/signup','/login','/subscribe','/forgot-password','/reset-password','/robots.txt','/sitemap.xml','/manifest.webmanifest','/opengraph-image','/search.json']); // search.json = name/slug/team/category only, no stats
const PUBLIC_PREFIX=['/props']; // public SEO prop pages (limited summary only)
const PUBLIC_API=['/api/auth','/api/signup','/api/me','/api/promo','/api/stripe','/api/password'];
const SIGNED_IN_OK=['/account','/api/account']; // any signed-in user, member or not
// Free-account features (paid-only inside these pages, e.g. Best Props 4+ and the line explorer, stays behind <Gate>).
const FREE_PATHS=['/streaks','/players','/teams','/matchups','/injuries','/leaders','/insights','/pindex.json','/api/streaksearch']; // /api/streaksearch counts free searches itself
const RURL=()=>process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL; const RTOK=()=>process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
async function member(email:string){ if(isAdminEmail(email)||isFreeAccessEmail(email)) return true; if(!RURL()||!RTOK()) return false;
  try{ const r=await fetch(`${RURL()}/get/${encodeURIComponent('user:'+email)}`,{headers:{Authorization:`Bearer ${RTOK()}`},cache:'no-store'}); if(!r.ok) return false;
    const {result}=await r.json(); const u=typeof result==='string'?JSON.parse(result):result; return !!u&&(u.free===true||['active','trialing'].includes(u.subStatus)||(typeof u.freeUntil==='number'&&u.freeUntil>Date.now())); }catch{ return false; } }
async function redisCmd(...args:string[]){ if(!RURL()||!RTOK()) return null; try{ const r=await fetch(RURL()!,{method:'POST',headers:{Authorization:`Bearer ${RTOK()}`,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'}); return r.ok?(await r.json()).result:null; }catch{ return null; } }
// Only real page loads (Sec-Fetch-Dest: document) can spend a free player view; prefetch/RSC fetches for an unviewed player get an empty 204
// and the router falls back to a full page load, which is counted.
const isPrefetch=(req:NextRequest)=>{ const d=req.headers.get('sec-fetch-dest'); return !!d&&d!=='document'; };
// Free accounts: PLAYER_WEEK_LIMIT distinct /players/<slug> pages per ISO week. Returns null when over the limit.
async function freePlayer(req:NextRequest, slug:string, email:string){ const k=playerWeekKey(email);
  if(await redisCmd('SISMEMBER',k,slug)===1) return NextResponse.next();
  if(isPrefetch(req)) return new NextResponse(null,{status:204});
  const n=await redisCmd('SCARD',k); if(typeof n!=='number'||n>=PLAYER_WEEK_LIMIT) return null;
  await redisCmd('SADD',k,slug); await redisCmd('EXPIRE',k,String(PLAYER_WEEK_TTL)); return NextResponse.next(); }
const starts=(p:string,l:string[])=>l.some(x=>p===x||p.startsWith(x+'/'));
export async function middleware(req:NextRequest){ const p=req.nextUrl.pathname;
  if(PUBLIC_PAGES.has(p)||starts(p,PUBLIC_API)||starts(p,PUBLIC_PREFIX)) return NextResponse.next();
  const tok=await getToken({req,secret:process.env.NEXTAUTH_SECRET}); const email=(tok?.email||'').toString().trim().toLowerCase();
  if(!email){ if(p==='/') return NextResponse.rewrite(new URL('/welcome',req.url)); // public preview home
    if(starts(p,['/matchups','/injuries'])){ const res=NextResponse.next(); res.headers.set('Cache-Control','private, no-store'); return res; } // matchup injury reports and the injury desk are public
    if(p.startsWith('/api/')||p.endsWith('.json')) return NextResponse.json({error:'Sign in required'},{status:401});
    const u=req.nextUrl.clone(); u.search=''; u.pathname='/signup'; u.searchParams.set('callbackUrl',p); return NextResponse.redirect(u); }
  const pm=p.match(/^\/players\/([a-z0-9-]+)\/?$/);
  if(pm&&!await member(email)){ const r=await freePlayer(req,pm[1],email); if(r){ r.headers.set('Cache-Control','private, no-store'); return r; }
    const u=req.nextUrl.clone(); u.search=''; u.pathname='/subscribe'; u.searchParams.set('reason','limit'); return NextResponse.redirect(u); }
  if(starts(p,SIGNED_IN_OK)||p==='/'||starts(p,FREE_PATHS)){ const res=NextResponse.next(); res.headers.set('Cache-Control','private, no-store'); return res; }
  if(await member(email)){ const res=NextResponse.next(); res.headers.set('Cache-Control','private, no-store'); return res; }
  if(p.startsWith('/api/')||p.endsWith('.json')) return NextResponse.json({error:'Membership required'},{status:402});
  const u=req.nextUrl.clone(); u.search=''; u.pathname='/subscribe'; return NextResponse.redirect(u); }
// Skip Next internals and static image/icon assets; everything else (pages, /api, *.json data files) goes through the check.
export const config={ matcher:['/((?!_next/static|_next/image|favicon|icon|apple-touch-icon|logo\\.svg|.*\\.(?:png|svg|ico|webp|jpg)$).*)'] };
