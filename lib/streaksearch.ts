import { getServerSession } from 'next-auth'; import { authOptions, redis } from '@/lib/auth'; import { getUser, isMember, isAdmin } from '@/lib/member'; import { players } from '@/lib/data';
import { buildPgames, normalizeQuery, runQuery } from '@/lib/props.mjs'; import { STREAK_SEARCH_LIMIT, streakSearchKey } from '@/lib/limits';
// Server-side prop search: the builder's per-game data never goes to the browser; free accounts get STREAK_SEARCH_LIMIT distinct searches total.
let pg:any=null; const pgames=()=>pg ||= buildPgames(players);
export const queryKey=(q:any)=>{ const n=normalizeQuery(q); return Object.keys(n).sort().map(k=>`${k}=${n[k]}`).join('&'); };
export type SearchResult={signedIn:boolean,member:boolean,locked:boolean,left:number|null,rows:any[]};
export async function streakSearch(q:any):Promise<SearchResult>{ const s=await getServerSession(authOptions); const email=s?.user?.email?.trim().toLowerCase();
  if(!email) return {signedIn:false,member:false,locked:true,left:null,rows:[]};
  const member=isAdmin(email)||isMember(await getUser(email)); const run=()=>runQuery(pgames(),normalizeQuery(q)) as any[];
  if(member) return {signedIn:true,member:true,locked:false,left:null,rows:run()};
  const r=redis(); const k=streakSearchKey(email); const qk=queryKey(q);
  if(!(await r.sismember(k,qk))){ const used=Number(await r.scard(k))||0; if(used>=STREAK_SEARCH_LIMIT) return {signedIn:true,member:false,locked:true,left:0,rows:[]}; await r.sadd(k,qk); }
  const left=Math.max(0,STREAK_SEARCH_LIMIT-(Number(await r.scard(k))||0)); return {signedIn:true,member:false,locked:false,left,rows:run()}; }
