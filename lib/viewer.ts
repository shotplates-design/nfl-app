import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { getUser, isMember, isAdmin, hasFreeAccess } from '@/lib/member';
// Server-side membership check for the current request. Pages that call this render per session (dynamic), so paid-only data
// never reaches a non-member's HTML/RSC payload.
export async function viewerIsMember(){ try{ const s=await getServerSession(authOptions); const e=s?.user?.email; if(!e) return false; if(isAdmin(e)||hasFreeAccess(e)) return true; return isMember(await getUser(e)); }catch{ return false; } }
// Free player views left this ISO week for the signed-in free account (display only; middleware enforces it).
import { redis } from '@/lib/auth'; import { PLAYER_WEEK_LIMIT, playerWeekKey } from '@/lib/limits';
export async function playerViewsLeft(){ try{ const s=await getServerSession(authOptions); const e=s?.user?.email?.trim().toLowerCase(); if(!e||isAdmin(e)||hasFreeAccess(e)) return null;
  return Math.max(0,PLAYER_WEEK_LIMIT-(Number(await redis().scard(playerWeekKey(e)))||0)); }catch{ return null; } }
