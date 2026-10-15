import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { getUser, isMember, isAdmin, hasFreeAccess } from '@/lib/member';
// Server-side membership check for the current request. Pages that call this render per session (dynamic), so paid-only data
// never reaches a non-member's HTML/RSC payload.
// Same membership rule as Best Props 4+: admin, always-granted, promo/paid. signedIn is only for which CTA to show.
export async function viewerAccess(){ try{ const s=await getServerSession(authOptions); const e=s?.user?.email; if(!e) return {signedIn:false,member:false}; if(isAdmin(e)||hasFreeAccess(e)) return {signedIn:true,member:true}; return {signedIn:true,member:isMember(await getUser(e))}; }catch{ return {signedIn:false,member:false}; } }
export async function viewerIsMember(){ return (await viewerAccess()).member; }
// Free player views left this ISO week for the signed-in free account (display only; middleware enforces it).
import { redis } from '@/lib/auth'; import { PLAYER_WEEK_LIMIT, playerWeekKey } from '@/lib/limits';
export async function playerViewsLeft(){ try{ const s=await getServerSession(authOptions); const e=s?.user?.email?.trim().toLowerCase(); if(!e||isAdmin(e)||hasFreeAccess(e)) return null;
  return Math.max(0,PLAYER_WEEK_LIMIT-(Number(await redis().scard(playerWeekKey(e)))||0)); }catch{ return null; } }
