// Pure betslip helpers. No API key, no Redis, no fetch. Safe to unit-check without credentials.
export const BOOKS = ['draftkings','betmgm','espnbet'] as const;
export type BookKey = typeof BOOKS[number];
export const BOOK_TITLE: Record<BookKey,string> = { draftkings:'DraftKings', betmgm:'BetMGM', espnbet:'theScore' };
// Our stat keys -> The Odds API player-prop markets. Only these are fetched (credit budget).
export const STAT_MARKET: Record<string,string> = {
  passYds:'player_pass_yds', passTd:'player_pass_tds', rushYds:'player_rush_yds',
  recYds:'player_reception_yds', rec:'player_receptions', rrTd:'player_anytime_td',
};
export const PROP_MARKETS = [...new Set(Object.values(STAT_MARKET))];
export type LinkKind = 'betslip'|'market'|'event';
export type StoredBook = { ol?:string; ml?:string; el?:string; os?:string; ms?:string; es?:string };
export type StoredLeg = {
  player:string; display:string; market:string; point:number|null; side:string;
  eventId:string; home:string; away:string; books:Partial<Record<BookKey,StoredBook>>;
};
export type OddsCache = { at:number; events:{id:string;home:string;away:string;commence:string}[]; legs:StoredLeg[] };
export type InLeg = { name:string; stat:string; line:number; side?:string; team?:string; teamName?:string };
export type OutLink = { book:BookKey; title:string; link:string; kind:LinkKind };

export function normName(s:string){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/['’.]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
export function samePlayer(a:string,b:string){ const x=normName(a), y=normName(b); if(!x||!y) return false; return x===y || x.endsWith(' '+y) || y.endsWith(' '+x); }
export function legStat(r:{stat?:string;field?:string;group?:string}|null|undefined){ const f=r?.stat||r?.field||'';
  if(f in STAT_MARKET) return f;
  if(f==='primYds') return r?.group==='receiving' ? 'recYds' : 'rushYds';
  if(f==='primTd') return 'rrTd';
  return null; }
export function httpsLink(u:unknown){ if(typeof u!=='string' || !u.startsWith('https://')) return undefined; try{ const x=new URL(u); if(x.searchParams.has('apiKey')) return undefined; return x.toString(); }catch{ return undefined; } }

const tol = (stat:string)=> stat==='passYds'||stat==='rushYds'||stat==='recYds' ? 12.5 : 1.5;
const targetPoint = (line:number)=> Number.isInteger(line) ? line-0.5 : line;

function single(b:StoredBook|undefined): {link:string;kind:LinkKind}|null {
  if(!b) return null;
  if(b.ol) return {link:b.ol, kind:'betslip'};
  if(b.ml) return {link:b.ml, kind:'market'};
  if(b.el) return {link:b.el, kind:'event'};
  return null;
}
function eventForTeam(cache:OddsCache, teamName?:string){ const n=normName(teamName||''); if(!n) return undefined;
  return cache.events.find(e=>normName(e.home)===n || normName(e.away)===n || samePlayer(e.home, teamName||'') || samePlayer(e.away, teamName||'')); }

/** Deepest link for one book: outcome betslip, else market, else event. */
export function bookLink(cache:OddsCache, leg:InLeg, book:BookKey): (OutLink & {stored?:StoredBook; eventLink?:string}) | null {
  const market = STAT_MARKET[leg.stat]; if(!market) return null;
  const side = leg.stat==='rrTd' ? 'Yes' : (/^under$/i.test(leg.side||'') ? 'Under' : 'Over');
  const rows = cache.legs.filter(r=>r.market===market && r.side===side && samePlayer(r.player, leg.name) && r.books[book]);
  const target = targetPoint(Number(leg.line)||0);
  let best:StoredLeg|undefined, dist=Infinity;
  for(const r of rows){ if(r.point==null){ if(leg.stat==='rrTd' && !best) best=r; continue; }
    const d=Math.abs(r.point-target); if(d<dist){ dist=d; best=r; } }
  const close = !!best && (best.point==null || dist<=tol(leg.stat));
  if(close && best){ const s=single(best.books[book]); const b=best.books[book]; const eventLink=b?.el; if(s) return {book, title:BOOK_TITLE[book], ...s, stored:b, eventLink}; }
  const any = rows[0] || cache.legs.find(r=>r.market===market && samePlayer(r.player, leg.name) && r.books[book]);
  const b = any?.books[book];
  if(b?.ml) return {book, title:BOOK_TITLE[book], link:b.ml, kind:'market', eventLink:b.el};
  if(b?.el) return {book, title:BOOK_TITLE[book], link:b.el, kind:'event', eventLink:b.el};
  const ev = eventForTeam(cache, leg.teamName);
  const sample = ev && cache.legs.find(r=>r.eventId===ev.id && r.books[book]?.el);
  const el = sample?.books[book]?.el;
  if(el) return {book, title:BOOK_TITLE[book], link:el, kind:'event', eventLink:el};
  return null;
}

function dkParlay(parts:StoredBook[]){ if(parts.length<2 || parts.some(p=>!p.os||!p.es)) return null;
  const id = parts[0].es!;
  return `https://sportsbook.draftkings.com/event/${encodeURIComponent(id)}?outcomes=${parts.map(p=>encodeURIComponent(p.os!)).join('+')}`; }
function mgmBase(parts:StoredBook[]){ for(const p of parts){ const el=p.el; if(!el) continue; try{ return new URL(el).origin; }catch{ /* keep looking */ } } return 'https://sports.betmgm.com'; }
function mgmTriplet(p:StoredBook){ if(p.os && p.os.split('-').length>=3 && !p.ms) return p.os; if(!p.es||!p.ms||!p.os) return null; return `${p.es}-${p.ms}-${p.os}`; }
function mgmParlay(parts:StoredBook[]){ const t=parts.map(mgmTriplet); if(t.some(x=>!x)) return null; return `${mgmBase(parts)}/en/sports?options=${t.join(',')}`; }

export function resolveBets(cache:OddsCache|null, legs:InLeg[]){
  const clean = legs.filter(l=>l && l.name && STAT_MARKET[l.stat]).slice(0,12);
  const per = clean.map(leg=>{
    const books = BOOKS.map(b=>cache?bookLink(cache,leg,b):null).filter(Boolean) as OutLink[];
    return { name:leg.name, stat:leg.stat, line:leg.line, books:books.map(({book,title,link,kind})=>({book,title,link,kind})) };
  });
  const parlay:OutLink[] = [];
  if(cache && clean.length>=2){
    const picked = clean.map(leg=>({ leg, dk:bookLink(cache,leg,'draftkings'), mgm:bookLink(cache,leg,'betmgm'), ts:bookLink(cache,leg,'espnbet') }));
    const dk = picked.map(p=>p.dk?.stored).filter(Boolean) as StoredBook[];
    const dkUrl = dk.length===clean.length ? dkParlay(dk) : null;
    if(dkUrl) parlay.push({book:'draftkings', title:'DraftKings', link:dkUrl, kind:'betslip'});
    const mg = picked.map(p=>p.mgm?.stored).filter(Boolean) as StoredBook[];
    const mgUrl = mg.length===clean.length ? mgmParlay(mg) : null;
    if(mgUrl) parlay.push({book:'betmgm', title:'BetMGM', link:mgUrl, kind:'betslip'});
    const game = picked.map(p=>p.ts?.eventLink || p.ts?.stored?.el).find(Boolean);
    if(game) parlay.push({book:'espnbet', title:'theScore', link:game, kind:'event'});
  }
  return { legs:per, parlay };
}
