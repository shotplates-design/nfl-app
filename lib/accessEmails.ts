// Edge-safe (used by middleware.ts). Lists come from Vercel env vars, comma-separated, case-insensitive:
//   ADMIN_EMAILS        admin account(s)
//   FREE_ACCESS_EMAILS  full member access without a subscription (not admin)
// Unset or empty means nobody is granted access this way.
const list=(v?:string)=>(v||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
export const adminEmails=()=>list(process.env.ADMIN_EMAILS);
export const freeAccessEmails=()=>list(process.env.FREE_ACCESS_EMAILS);
const norm=(e?:string|null)=>(e||'').trim().toLowerCase();
export const isAdminEmail=(e?:string|null)=>!!norm(e)&&adminEmails().includes(norm(e));
export const isFreeAccessEmail=(e?:string|null)=>!!norm(e)&&freeAccessEmails().includes(norm(e));
