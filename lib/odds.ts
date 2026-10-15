// Server-only Odds API client. The key is read from process.env.ODDS_API_KEY and never returned to the client.
import { redis } from './auth'; import { TEAMS } from './data'; import { currentWeek } from './matchups';
import { BOOKS, PROP_MARKETS, httpsLink, normName, type BookKey, type OddsCache, type StoredLeg, type InLeg, resolveBets } from './betslip';
// Computed env access so the bundler does not inline an empty value when the key is absent at build time.
const env = (name:string) => (process.env as Record<string,string|undefined>)[name];
export const oddsEnabled = () => !!env('ODDS_API_KEY');
const CACHE_KEY = 'odds:nfl';
const FRESH_MS = 3*60*60*1000;
const CACHE_TTL = 36*60*60;
export const MONTHLY_CAP = 450; // free plan is 500; leave headroom for the events call and header rounding
const MAX_EVENTS = 2; // featured games only
const redisReady = () => !!(env('UPSTASH_REDIS_REST_URL')||env('KV_REST_API_URL')) && !!(env('UPSTASH_REDIS_REST_TOKEN')||env('KV_REST_API_TOKEN'));
const monthKey = () => `odds:credits:${new Date().toISOString().slice(0,7)}`;

async function creditsUsed(){ if(!redisReady()) return 0; return Number(await redis().get(monthKey()))||0; }
async function addCredits(n:number){ if(!redisReady()||!(n>0)) return; const r=redis(); const k=monthKey(); await r.incrby(k, Math.round(n)); await r.expire(k, 40*24*60*60); }

function apiUrl(path:string, params:Record<string,string>){ const u=new URL(`https://api.the-odds-api.com/v4/${path}`);
  u.searchParams.set('apiKey', env('ODDS_API_KEY')||''); for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v); return u; }
async function oddsGet(path:string, params:Record<string,string>){ const res=await fetch(apiUrl(path,params), {cache:'no-store'});
  const last=Number(res.headers.get('x-requests-last'))||0; const remaining=res.headers.get('x-requests-remaining');
  await addCredits(last); return { res, last, remaining: remaining==null?null:Number(remaining) }; }

function sideOf(name:string){ return /^over$/i.test(name)?'Over':/^under$/i.test(name)?'Under':'Yes'; }
function playerOf(o:{name?:string;description?:string}){ const d=o.description&&!/^(over|under)$/i.test(o.description)?o.description:''; if(d) return d;
  return o.name&&!/^(over|under)$/i.test(o.name)?o.name:''; }

export function compressEvent(ev:any): StoredLeg[] { const out:StoredLeg[]=[]; const by=new Map<string,StoredLeg>();
  for(const book of ev?.bookmakers||[]){ if(!BOOKS.includes(book.key)) continue; const bk=book.key as BookKey; const el=httpsLink(book.link); const es=book.sid?String(book.sid):undefined;
    for(const m of book.markets||[]){ if(!PROP_MARKETS.includes(m.key)) continue; const ml=httpsLink(m.link); const ms=m.sid?String(m.sid):undefined;
      for(const o of m.outcomes||[]){ const player=playerOf(o); if(!player) continue; const side=sideOf(o.name||''); const point=typeof o.point==='number'?o.point:null;
        const id=`${normName(player)}|${m.key}|${side}|${point??''}|${ev.id}`;
        let row=by.get(id); if(!row){ row={player, display:player, market:m.key, point, side, eventId:String(ev.id), home:ev.home_team||'', away:ev.away_team||'', books:{}}; by.set(id,row); out.push(row); }
        row.books[bk]={ ol:httpsLink(o.link), ml, el, os:o.sid?String(o.sid):undefined, ms, es:es }; } } }
  return out; }

function featured(events:any[]){ const now=Date.now(); const soon=(e:any)=>{ const t=Date.parse(e.commence_time); return Number.isFinite(t)&&t>=now-3*60*60*1000 && t<=now+6*24*60*60*1000; };
  const up=events.filter(soon).sort((a,b)=>Date.parse(a.commence_time)-Date.parse(b.commence_time));
  let names=new Set<string>(); try{ const w=currentWeek(); for(const g of w.games){ if(TEAMS[g.awayCode]) names.add(TEAMS[g.awayCode].toLowerCase()); if(TEAMS[g.homeCode]) names.add(TEAMS[g.homeCode].toLowerCase()); } }catch{ names=new Set(); }
  const week=names.size? up.filter(e=>names.has(String(e.home_team||'').toLowerCase()) && names.has(String(e.away_team||'').toLowerCase())) : [];
  const pick=(week.length?week:up).slice(0, MAX_EVENTS); return pick; }

export async function pullOdds(){ if(!oddsEnabled()) return {ok:true, skipped:'no ODDS_API_KEY'}; if(!redisReady()) return {ok:true, skipped:'no redis'};
  const r=redis(); const prev=await r.get<OddsCache>(CACHE_KEY); if(prev?.at && Date.now()-prev.at<FRESH_MS) return {ok:true, skipped:'fresh', at:prev.at};
  const used=await creditsUsed(); if(used>=MONTHLY_CAP) return {ok:true, skipped:'cap', used};
  const list=await oddsGet('sports/americanfootball_nfl/events', {}); if(!list.res.ok) return {ok:false, error:'events', status:list.res.status};
  const body=await list.res.json().catch(()=>[]); const events=featured(Array.isArray(body)?body:[]);
  const legs:StoredLeg[]=[]; const saved:OddsCache['events']=[]; let spent=list.last;
  for(const ev of events){ const cost=PROP_MARKETS.length; // 1 region-equivalent: 3 bookmakers is one group of 10
    if(used+spent+cost>MONTHLY_CAP) break; if(list.remaining!=null && list.remaining<cost) break;
    const q=await oddsGet(`sports/americanfootball_nfl/events/${encodeURIComponent(ev.id)}/odds`, {
      regions:'us', oddsFormat:'american', markets:PROP_MARKETS.join(','), bookmakers:BOOKS.join(','), includeLinks:'true', includeSids:'true' });
    spent+=q.last; if(!q.res.ok) continue; const body=await q.res.json(); const one=Array.isArray(body)?body[0]:body; if(!one) continue;
    legs.push(...compressEvent(one)); saved.push({id:String(one.id||ev.id), home:one.home_team||ev.home_team, away:one.away_team||ev.away_team, commence:one.commence_time||ev.commence_time});
    if(q.remaining!=null && q.remaining<cost) break; }
  const cache:OddsCache={ at:Date.now(), events:saved, legs }; await r.set(CACHE_KEY, cache, {ex:CACHE_TTL});
  return {ok:true, events:saved.length, legs:legs.length, credits:await creditsUsed()}; }

export async function betLinks(legs:InLeg[]){ if(!oddsEnabled()||!redisReady()) return {available:false, legs:[], parlay:[] as any[]};
  const cache=await redis().get<OddsCache>(CACHE_KEY); const team=(code?:string)=> code&&TEAMS[code]?TEAMS[code]:undefined;
  const mapped=legs.map(l=>({...l, teamName:l.teamName||team((l as any).team)}));
  return { available:!!cache, ...resolveBets(cache, mapped) }; }
