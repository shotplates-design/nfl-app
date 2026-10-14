import { NextResponse, type NextRequest } from 'next/server'; import { getToken } from 'next-auth/jwt';
// Server-side paywall. Every page, RSC payload, data JSON and API not listed as public requires a signed-in member
// (active/trialing Stripe subscription, promo 'free' flag, or the admin account). Membership is read from Upstash Redis on each gated request.
const ADMIN='drosser1724@yahoo.com';
const PUBLIC_PAGES=new Set(['/welcome','/signup','/login','/subscribe','/forgot-password','/reset-password','/robots.txt','/sitemap.xml','/manifest.webmanifest','/opengraph-image','/search.json']); // search.json = name/slug/team/category only, no stats
const PUBLIC_API=['/api/auth','/api/signup','/api/me','/api/promo','/api/stripe','/api/password'];
const SIGNED_IN_OK=['/account','/api/account']; // any signed-in user, member or not
const RURL=()=>process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL; const RTOK=()=>process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
async function member(email:string){ if(email===ADMIN) return true; if(!RURL()||!RTOK()) return false;
  try{ const r=await fetch(`${RURL()}/get/${encodeURIComponent('user:'+email)}`,{headers:{Authorization:`Bearer ${RTOK()}`},cache:'no-store'}); if(!r.ok) return false;
    const {result}=await r.json(); const u=typeof result==='string'?JSON.parse(result):result; return !!u&&(u.free===true||['active','trialing'].includes(u.subStatus)); }catch{ return false; } }
// Free player lookups for non-members: up to FREE_LIMIT distinct /players/<slug> pages.
// Signed-out: list kept in an httpOnly cookie signed with HMAC-SHA256(NEXTAUTH_SECRET). Signed-in unpaid: Redis set free:<email>.
const FREE_LIMIT=5, FCOOKIE='tpp_free', FREE_TTL=60*60*24*30;
const clientIp=(req:NextRequest)=>(req.headers.get('x-forwarded-for')?.split(',')[0]||req.headers.get('x-real-ip')||req.ip||'unknown').trim();
const b64u=(b:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hmac(data:string){ const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(process.env.NEXTAUTH_SECRET||''),{name:'HMAC',hash:'SHA-256'},false,['sign']); return b64u(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(data))); }
async function readCookie(v?:string):Promise<string[]>{ if(!v) return []; const [d,sig]=v.split('.'); if(!d||!sig||sig!==await hmac(d)) return [];
  try{ const a=JSON.parse(atob(d.replace(/-/g,'+').replace(/_/g,'/'))); return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,FREE_LIMIT):[]; }catch{ return []; } }
async function writeCookie(list:string[]){ const d=b64u(new TextEncoder().encode(JSON.stringify(list))); return `${d}.${await hmac(d)}`; }
async function redisCmd(...args:string[]){ if(!RURL()||!RTOK()) return null; try{ const r=await fetch(RURL()!,{method:'POST',headers:{Authorization:`Bearer ${RTOK()}`,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'}); return r.ok?(await r.json()).result:null; }catch{ return null; } }
// Next strips its RSC/prefetch headers before middleware, so only real page loads (Sec-Fetch-Dest: document) spend a lookup.
// Client-side RSC fetches/prefetches for an unlisted player get an empty 204; the router then falls back to a full page load, which is counted.
const isPrefetch=(req:NextRequest)=>{ const d=req.headers.get('sec-fetch-dest'); return !!d&&d!=='document'; };
async function freePlayer(req:NextRequest, slug:string, email:string){
  if(!process.env.NEXTAUTH_SECRET) return null;
  if(email){ const k=`free:${email}`; if(await redisCmd('SISMEMBER',k,slug)===1) return NextResponse.next();
    if(isPrefetch(req)) return new NextResponse(null,{status:204}); // never spend a lookup on a prefetch/RSC fetch
    const n=await redisCmd('SCARD',k); if(typeof n!=='number'||n>=FREE_LIMIT) return null; await redisCmd('SADD',k,slug); return NextResponse.next(); }
  // Signed-out: IP-keyed Redis set is authoritative (in-app webviews like Instagram drop cookies); signed cookie is merged in as an extra signal.
  const ip=clientIp(req); const k=`freeip:${ip}`; const list=await readCookie(req.cookies.get(FCOOKIE)?.value);
  if(list.length) await redisCmd('SADD',k,...list);
  const seen=await redisCmd('SISMEMBER',k,slug)===1||list.includes(slug);
  if(!seen&&isPrefetch(req)) return new NextResponse(null,{status:204});
  if(!seen){ const n=await redisCmd('SCARD',k); if(typeof n!=='number'||n>=FREE_LIMIT) return null; await redisCmd('SADD',k,slug); }
  await redisCmd('EXPIRE',k,String(FREE_TTL));
  const all=[...new Set([...list,slug])].slice(0,FREE_LIMIT);
  const res=NextResponse.next(); res.cookies.set(FCOOKIE,await writeCookie(all),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*24*365}); return res; }
const starts=(p:string,l:string[])=>l.some(x=>p===x||p.startsWith(x+'/'));
export async function middleware(req:NextRequest){ const p=req.nextUrl.pathname;
  if(PUBLIC_PAGES.has(p)||starts(p,PUBLIC_API)) return NextResponse.next();
  const tok=await getToken({req,secret:process.env.NEXTAUTH_SECRET}); const email=(tok?.email||'').toString().trim().toLowerCase();
  if(email&&starts(p,SIGNED_IN_OK)) return NextResponse.next();
  const ok=!!email&&await member(email);
  if(ok){ const res=NextResponse.next(); res.headers.set('Cache-Control','private, no-store'); return res; }
  const pm=p.match(/^\/players\/([a-z0-9-]+)\/?$/);
  if(pm){ const r=await freePlayer(req,pm[1],email); if(r){ r.headers.set('Cache-Control','private, no-store'); return r; }
    const u=req.nextUrl.clone(); u.search=''; u.pathname='/subscribe'; u.searchParams.set('reason','limit'); return NextResponse.redirect(u); }
  if(p==='/') return NextResponse.rewrite(new URL('/welcome',req.url)); // public marketing home, no data
  if(p.startsWith('/api/')||p.endsWith('.json')) return NextResponse.json({error:email?'Membership required':'Sign in required'},{status:email?402:401});
  const u=req.nextUrl.clone(); u.search=''; if(email){ u.pathname='/subscribe'; } else { u.pathname='/login'; u.searchParams.set('callbackUrl',p); } return NextResponse.redirect(u); }
// Skip Next internals and static image/icon assets; everything else (pages, /api, *.json data files) goes through the check.
export const config={ matcher:['/((?!_next/static|_next/image|favicon|icon|apple-touch-icon|logo\\.svg|.*\\.(?:png|svg|ico|webp|jpg)$).*)'] };
