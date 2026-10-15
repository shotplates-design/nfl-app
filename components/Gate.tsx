'use client'; import Link from 'next/link'; import { useMe } from './useMe';
// Members-only wrapper. Content stays in the HTML (crawlable) but is blurred and inert for non-members, with a subscribe CTA.
export default function Gate({children,label='This feature'}:{children:React.ReactNode,label?:string}){ const me=useMe(); const open=me?.member;
  if(open) return <>{children}</>;
  return <div className="relative"><div aria-hidden="true" className="blur-sm pointer-events-none select-none max-h-[520px] overflow-hidden" {...{inert:''} as any}>{children}</div>
   <div className="absolute inset-0 flex items-start justify-center pt-10 bg-gradient-to-b from-slate-950/40 to-slate-950/90">
    <div className="card max-w-xs text-center space-y-2"><p className="font-semibold text-white">🔒 {label} is for members</p><p className="text-sm text-slate-400">Membership ($4.99/mo) adds the full Best Props board, line explorer, Sleepers, watchlist, compare and dashboard.</p>
     <Link href={me?.signedIn?'/subscribe':'/signup'} className="block rounded-lg bg-emerald-600 py-2 font-semibold text-white no-underline">{me?.signedIn?'Become a member – $4.99/mo':'Sign up free'}</Link>
     {!me?.signedIn&&<p className="text-xs text-slate-500">Have an account? <Link href="/login">Log in</Link></p>}</div></div></div>; }
