// Server-only Odds API client. The key is read from process.env.ODDS_API_KEY and never returned to the client.
import { redis } from './auth';
import { TEAMS, players, bySlug, bestHot } from './data';
import { currentWeek } from './matchups';
import { BOOKS, PROP_MARKETS, httpsLink, normName, legStat, samePlayer, STAT_MARKET, type BookKey, type OddsCache, type StoredLeg, type InLeg, resolveBets } from './betslip';
import { PLAYER_MARKETS, MARKET_META, CAT_MARKET, CREDIT_FLOOR, pullDecision, groupsFromLegs, chipForLeg, type LineGroup } from './lines';

const env = (name: string) => (process.env as Record<string, string | undefined>)[name];
export const oddsEnabled = () => !!env('ODDS_API_KEY');
const CACHE_KEY = 'odds:nfl';
const GAME_TTL = 6 * 24 * 60 * 60;
const LIST_TTL = 6 * 60 * 60;
export const MONTHLY_CAP = 450;
const redisReady = () => !!(env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL')) && !!(env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN'));
const monthKey = () => `odds:credits:${new Date().toISOString().slice(0, 7)}`;

type Ev = { id: string; home: string; away: string; commence: string };
type GameCache = { at: number; id: string; home: string; away: string; commence: string; preKick: boolean; legs: StoredLeg[] };
export type WatchOffer = { name: string; stat: string; line: number; team: string; label: string };

async function creditsUsed() { if (!redisReady()) return 0; return Number(await redis().get(monthKey())) || 0; }
async function addCredits(n: number) { if (!redisReady() || !(n > 0)) return; const r = redis(); const k = monthKey(); await r.incrby(k, Math.round(n)); await r.expire(k, 40 * 24 * 60 * 60); }
async function creditsLeft(): Promise<number | null> {
  if (!redisReady()) return null;
  const n = await redis().get('odds:remaining');
  if (n == null) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function apiUrl(path: string, params: Record<string, string>) {
  const u = new URL(`https://api.the-odds-api.com/v4/${path}`);
  u.searchParams.set('apiKey', env('ODDS_API_KEY') || '');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u;
}
async function oddsGet(path: string, params: Record<string, string>) {
  const res = await fetch(apiUrl(path, params), { cache: 'no-store' });
  const last = Number(res.headers.get('x-requests-last')) || 0;
  const remHeader = res.headers.get('x-requests-remaining');
  const remaining = remHeader == null || remHeader === '' ? null : Number(remHeader);
  console.log(`[odds] ${path} status=${res.status} last=${last} remaining=${remaining ?? '-'}`);
  await addCredits(last);
  if (redisReady() && remaining != null && Number.isFinite(remaining)) await redis().set('odds:remaining', remaining, { ex: 40 * 24 * 60 * 60 });
  return { res, last, remaining };
}

function sideOf(name: string) { return /^over$/i.test(name) ? 'Over' : /^under$/i.test(name) ? 'Under' : 'Yes'; }
function playerOf(o: { name?: string; description?: string }) {
  const d = o.description && !/^(over|under|yes|no)$/i.test(o.description) ? o.description : '';
  if (d) return d;
  return o.name && !/^(over|under|yes|no)$/i.test(o.name) ? o.name : '';
}

export function compressEvent(ev: any): StoredLeg[] {
  const out: StoredLeg[] = []; const by = new Map<string, StoredLeg>();
  for (const book of ev?.bookmakers || []) {
    if (!BOOKS.includes(book.key)) continue;
    const bk = book.key as BookKey; const el = httpsLink(book.link); const es = book.sid ? String(book.sid) : undefined;
    for (const m of book.markets || []) {
      if (!MARKET_META[m.key] && !PROP_MARKETS.includes(m.key)) continue;
      const ml = httpsLink(m.link); const ms = m.sid ? String(m.sid) : undefined;
      for (const o of m.outcomes || []) {
        const player = playerOf(o); if (!player || /d\/st/i.test(player)) continue;
        const side = sideOf(o.name || ''); const point = typeof o.point === 'number' ? o.point : null;
        const id = `${normName(player)}|${m.key}|${side}|${point ?? ''}|${ev.id}`;
        let row = by.get(id);
        if (!row) {
          row = { player, display: player, market: m.key, point, side, eventId: String(ev.id), home: ev.home_team || '', away: ev.away_team || '', books: {} };
          by.set(id, row); out.push(row);
        }
        row.books[bk] = { ol: httpsLink(o.link), ml, el, os: o.sid ? String(o.sid) : undefined, ms, es };
        if (bk === 'draftkings' && (side === 'Over' || side === 'Yes') && typeof o.price === 'number' && row.price == null) row.price = o.price;
      }
    }
  }
  return out;
}

function weekPairs() {
  try {
    const w = currentWeek();
    return (w?.games || []).map(g => ({ home: (TEAMS[g.homeCode] || g.home).toLowerCase(), away: (TEAMS[g.awayCode] || g.away).toLowerCase() }));
  } catch { return []; }
}
const teamIn = (ev: Ev, code: string) => { const n = (TEAMS[code] || '').toLowerCase(); return !!n && (ev.home.toLowerCase() === n || ev.away.toLowerCase() === n); };

async function loadWeekEvents(): Promise<Ev[]> {
  if (!redisReady()) return [];
  const r = redis();
  const hit = await r.get<{ at: number; events: Ev[] }>('odds:events');
  if (hit?.events && Date.now() - hit.at < LIST_TTL * 1000) return hit.events;
  if (!oddsEnabled()) return hit?.events || [];
  const list = await oddsGet('sports/americanfootball_nfl/events', {});
  if (!list.res.ok) return hit?.events || [];
  const body = await list.res.json().catch(() => []);
  const pairs = weekPairs();
  const events: Ev[] = (Array.isArray(body) ? body : []).filter((e: any) => pairs.some(p => String(e.home_team || '').toLowerCase() === p.home && String(e.away_team || '').toLowerCase() === p.away))
    .map((e: any) => ({ id: String(e.id), home: e.home_team, away: e.away_team, commence: e.commence_time }));
  if (events.length) await r.set('odds:events', { at: Date.now(), events }, { ex: LIST_TTL });
  return events.length ? events : (hit?.events || []);
}

async function ensureEvent(ev: Ev): Promise<GameCache | null> {
  if (!redisReady()) return null;
  const key = `odds:g:${ev.id}`;
  const cached = await redis().get<GameCache>(key);
  const left = await creditsLeft();
  const decision = pullDecision(cached, ev.commence, Date.now(), left);
  if (decision === 'serve') return cached;
  if (decision === 'skip' || !oddsEnabled()) {
    console.log(`[odds] skip ${ev.away} @ ${ev.home} remaining=${left ?? '-'} floor=${CREDIT_FLOOR}`);
    return cached;
  }
  const q = await oddsGet(`sports/americanfootball_nfl/events/${encodeURIComponent(ev.id)}/odds`, {
    regions: 'us', oddsFormat: 'american', markets: PLAYER_MARKETS.join(','), bookmakers: 'draftkings', includeLinks: 'true', includeSids: 'true',
  });
  if (q.remaining != null && q.remaining < CREDIT_FLOOR) console.log(`[odds] remaining ${q.remaining} is under ${CREDIT_FLOOR}; further refreshes stop`);
  if (!q.res.ok) return cached;
  const body = await q.res.json().catch(() => null);
  const one = Array.isArray(body) ? body[0] : body;
  if (!one) return cached;
  const kick = Date.parse(one.commence_time || ev.commence);
  const before = kick - Date.now();
  const game: GameCache = {
    at: Date.now(), id: String(one.id || ev.id), home: one.home_team || ev.home, away: one.away_team || ev.away,
    commence: one.commence_time || ev.commence, preKick: decision === 'refresh' || (before > 0 && before <= 2 * 60 * 60 * 1000),
    legs: compressEvent(one),
  };
  await redis().set(key, game, { ex: GAME_TTL });
  console.log(`[odds] saved ${game.away} @ ${game.home} markets=${new Set(game.legs.map(l => l.market)).size} legs=${game.legs.length} preKick=${game.preKick} remaining=${q.remaining ?? '-'}`);
  return game;
}

/** Pull each of this week's games once, the first time a member needs it. Refresh once, about two hours before kickoff. */
export async function ensureTeams(codes: string[]) {
  if (!oddsEnabled() || !redisReady() || !codes.length) return [] as GameCache[];
  const events = await loadWeekEvents();
  const want = events.filter(e => codes.some(c => teamIn(e, c)));
  const out: GameCache[] = [];
  for (const ev of want) {
    const left = await creditsLeft();
    if (left != null && left < CREDIT_FLOOR && !(await redis().get(`odds:g:${ev.id}`))) { console.log(`[odds] halt before ${ev.away} @ ${ev.home}`); break; }
    const g = await ensureEvent(ev);
    if (g) out.push(g);
  }
  return out;
}

async function cacheForTeams(codes: string[]): Promise<OddsCache> {
  const events = codes.length ? await loadWeekEvents() : [];
  const want = events.filter(e => codes.some(c => teamIn(e, c)));
  const games: GameCache[] = [];
  for (const ev of want) { const g = await redis().get<GameCache>(`odds:g:${ev.id}`); if (g) games.push(g); }
  const legacy = await redis().get<OddsCache>(CACHE_KEY);
  const legs = games.flatMap(g => g.legs);
  const evs = games.map(g => ({ id: g.id, home: g.home, away: g.away, commence: g.commence }));
  if (legacy?.legs?.length) {
    for (const e of legacy.events || []) if (!evs.some(x => x.id === e.id)) evs.push(e);
    legs.push(...legacy.legs);
  }
  return { at: Date.now(), events: evs, legs };
}

export async function lineGroupsForTeams(codes: string[]): Promise<Record<string, LineGroup[]>> {
  const games = await ensureTeams(codes);
  const out: Record<string, LineGroup[]> = {};
  for (const code of codes) {
    const game = games.find(g => teamIn(g, code));
    const roster = players.filter(p => p.team === code);
    out[code] = game ? groupsFromLegs(roster, game.legs) : [];
  }
  return out;
}
export async function lineGroupForPlayer(p: { name: string; team: string; games?: any[] }) {
  const games = await ensureTeams([p.team]);
  const game = games.find(g => teamIn(g, p.team));
  if (!game) return null;
  return groupsFromLegs([p], game.legs)[0] || null;
}

export async function offersForSlugs(slugs: string[]): Promise<Record<string, WatchOffer>> {
  const list = slugs.slice(0, 40).map(s => bySlug(s)).filter((p): p is NonNullable<ReturnType<typeof bySlug>> => !!p);
  const games = await ensureTeams([...new Set(list.map(p => p.team))]);
  const out: Record<string, WatchOffer> = {};
  for (const p of list) {
    const game = games.find(g => teamIn(g, p.team));
    const mine = (game?.legs || []).filter(l => (l.side === 'Over' || l.side === 'Yes') && samePlayer(l.player, p.name));
    const want = CAT_MARKET[p.cat || ''];
    const bettable = (l: StoredLeg) => { const s = MARKET_META[l.market]?.stat; return !!s && !!STAT_MARKET[s]; };
    const leg = mine.find(l => l.market === want && bettable(l)) || mine.find(l => bettable(l) && (l.point != null || MARKET_META[l.market]?.yes));
    if (leg) {
      const stat = MARKET_META[leg.market].stat!;
      out[p.slug] = { name: p.name, stat, line: leg.point ?? 0.5, team: p.team, label: chipForLeg(p.games, leg) };
      continue;
    }
    const h = bestHot(p); const st = h && legStat(h);
    if (h && st) out[p.slug] = { name: p.name, stat: st, line: h.thr, team: p.team, label: `${h.label} · hit ${h.hits}/${h.games}` };
  }
  return out;
}

/** Cron: the single pre-kickoff refresh for games inside the two-hour window. Other games wait until a member opens them. */
export async function pullOdds() {
  if (!oddsEnabled()) return { ok: true, skipped: 'no ODDS_API_KEY' };
  if (!redisReady()) return { ok: true, skipped: 'no redis' };
  const events = await loadWeekEvents();
  const now = Date.now();
  let refreshed = 0, skipped = 0;
  for (const ev of events) {
    const before = Date.parse(ev.commence) - now;
    if (!(before > 0 && before <= 2 * 60 * 60 * 1000)) continue;
    const left = await creditsLeft();
    if (left != null && left < CREDIT_FLOOR) { skipped++; break; }
    const g = await ensureEvent(ev);
    if (g && g.at > now - 120000) refreshed++; else skipped++;
  }
  return { ok: true, refreshed, skipped, remaining: await creditsLeft(), credits: await creditsUsed() };
}

export async function betLinks(legs: InLeg[]) {
  if (!oddsEnabled() || !redisReady()) return { available: false, legs: [] as any[], parlay: [] as any[] };
  const codes = [...new Set(legs.map(l => l.team).filter((t): t is string => !!t))];
  await ensureTeams(codes);
  const cache = await cacheForTeams(codes);
  const team = (code?: string) => code && TEAMS[code] ? TEAMS[code] : undefined;
  const mapped = legs.map(l => ({ ...l, teamName: l.teamName || team(l.team) }));
  const resolved = resolveBets(cache.legs.length ? cache : null, mapped);
  const available = resolved.legs.some(l => l.books.length > 0) || resolved.parlay.length > 0;
  return { available, ...resolved };
}
