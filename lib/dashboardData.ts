import { players, allStreaks } from './data';
import { loadInjuryDesk } from './injuryAnalysis';
import { currentWeek } from './matchups';
import { buildDashboard } from './dashboard.mjs';

async function cachedLegs() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return [];
  try {
    const { redis } = await import('./auth');
    const r = redis();
    const events = await r.get<{ events?: { id: string }[] }>('odds:events');
    const legs: any[] = [];
    for (const ev of events?.events || []) {
      const game = await r.get<{ legs?: any[] }>(`odds:g:${ev.id}`);
      if (game?.legs) legs.push(...game.legs);
    }
    return legs;
  } catch {
    return [];
  }
}

export async function loadDashboard() {
  const legs = await cachedLegs();
  return buildDashboard({ players, hot: allStreaks().hot, desk: loadInjuryDesk(), week: currentWeek(), legs });
}
