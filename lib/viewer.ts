import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth'; import { getUser, isMember, isAdmin } from '@/lib/member';
// Server-side membership check for the current request. Pages that call this render per session (dynamic), so paid-only data
// never reaches a non-member's HTML/RSC payload.
export async function viewerIsMember(){ try{ const s=await getServerSession(authOptions); const e=s?.user?.email; if(!e) return false; if(isAdmin(e)) return true; return isMember(await getUser(e)); }catch{ return false; } }
