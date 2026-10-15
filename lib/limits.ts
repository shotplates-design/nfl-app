// Free-account limits (shared by middleware, pages and API routes; pure, edge-safe).
export const STREAK_SEARCH_LIMIT=10; // total, no TTL: Redis set streaksearch:<email> of distinct executed queries
export const PLAYER_WEEK_LIMIT=15; // distinct player pages per ISO week: Redis set playerweek:<email>:<YYYY-Www>, TTL ~8 days
export const PLAYER_WEEK_TTL=60*60*24*8;
export function isoWeek(d=new Date()){ const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
  const y=t.getUTCFullYear(); const w=Math.ceil(((t.getTime()-Date.UTC(y,0,1))/864e5+1)/7); return `${y}-W${String(w).padStart(2,'0')}`; }
export const playerWeekKey=(email:string)=>`playerweek:${email}:${isoWeek()}`;
export const streakSearchKey=(email:string)=>`streaksearch:${email}`;
