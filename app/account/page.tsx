import { getServerSession } from 'next-auth'; import { redirect } from 'next/navigation'; import { authOptions } from '@/lib/auth'; import { getUser } from '@/lib/member';
import AccountActions from './AccountActions'; import RefLink from './RefLink'; import { ensureRefCode, referralCount } from '@/lib/referral';
export const metadata={title:'Account – ThePlayerProps',robots:{index:false}}; export const dynamic='force-dynamic';
export default async function P(){ const s=await getServerSession(authOptions); const email=s?.user?.email; if(!email) redirect('/login');
  const u:any=await getUser(email); const paid=['active','trialing'].includes(u?.subStatus); const refFree=typeof u?.freeUntil==='number'&&u.freeUntil>Date.now(); const status=paid?'Paid':u?.free?'Promo (free access)':refFree?`Referral free access until ${new Date(u.freeUntil).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'})}`:'None';
  const code=await ensureRefCode(email); const refs=await referralCount(email);
  return <div className="max-w-sm mx-auto space-y-4"><h1>Account</h1>
   <dl className="card grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-slate-400">Email</dt><dd className="break-all">{email}</dd>
    <dt className="text-slate-400">Membership</dt><dd>{status}{u?.subStatus&&!paid?` (${u.subStatus})`:''}</dd>
    {u?.created&&<><dt className="text-slate-400">Joined</dt><dd>{new Date(u.created).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'America/New_York'})}</dd></>}</dl>
   {status==='None'&&<a href="/subscribe" className="block text-center rounded-lg bg-emerald-600 py-2 font-semibold text-white no-underline">Subscribe</a>}
   <RefLink code={code} count={refs}/>
   <AccountActions billing={paid&&!!u?.stripeCustomer}/></div>; }
