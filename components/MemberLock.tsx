import Link from 'next/link';
// Members-only lock card shown when a free account hits a limit (no blurred content behind it).
export default function MemberLock({title,signedIn=true}:{title:string,signedIn?:boolean}){ return <div className="card max-w-sm mx-auto text-center space-y-2 my-3"><p className="font-semibold text-white">🔒 {title}</p>
  <p className="text-sm text-slate-400">Membership ($4.99/mo) adds unlimited prop searches and player pages, the full Best Props board, line explorer, Sleepers, watchlist, compare and dashboard.</p>
  <Link href={signedIn?'/subscribe':'/signup'} className="block rounded-lg bg-emerald-600 py-2 font-semibold text-white no-underline">{signedIn?'Become a member – $4.99/mo':'Sign up for full access'}</Link></div>; }
