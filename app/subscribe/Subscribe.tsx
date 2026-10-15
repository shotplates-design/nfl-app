'use client'; import { useState } from 'react'; import Link from 'next/link'; import { useMe } from '@/components/useMe';
export default function Subscribe(){ const me=useMe(); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false); const [done,setDone]=useState(false);
 const post=async(u:string,b?:any)=>{ const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b||{})}); return [r.ok,await r.json()] as const; };
 async function checkout(){ setBusy(true); setMsg(''); const [ok,j]=await post('/api/stripe/checkout'); setBusy(false); if(ok&&j.url) location.href=j.url; else setMsg(j.comingSoon?'Payments are coming soon. Use a promo code if you have one.':j.error); }
 async function promo(e:any){ e.preventDefault(); setBusy(true); setMsg(''); const [ok,j]=await post('/api/promo',{code:new FormData(e.target).get('code')}); setBusy(false); if(ok){ setDone(true); setMsg('Promo applied: you have full free access.'); } else setMsg(j.error); }
 async function portal(){ const [ok,j]=await post('/api/stripe/portal'); if(ok) location.href=j.url; else setMsg(j.error); }
 if(me&&!me.signedIn) return <div className="card max-w-sm mx-auto"><p><Link href="/signup">Sign up free</Link> (no card) or <Link href="/login">log in</Link> first.</p></div>;
 const member=done||me?.member;
 return <div className="card max-w-sm mx-auto space-y-4"><h1>{member?'You’re a member':'Become a member'}</h1>
  {member?<><p className="text-sm text-slate-300">{done||me?.free?'Free access via promo code.':'Subscription active.'}</p><Link href="/" className="block text-center rounded-lg bg-emerald-600 py-2 font-semibold text-white no-underline">Go to Best Props →</Link>
   {me?.canManage&&<button onClick={portal} className="w-full rounded-lg border border-slate-700 py-2">Manage billing</button>}</>
  :<><p className="text-sm text-slate-400">Your free account already includes streaks, the prop search builder, unlimited player pages, teams, matchups, leaders, insights and the top 3 Best Props. Membership adds the full Best Props board, line explorer, Sleepers, watchlist, compare and dashboard.</p>
   <button onClick={checkout} disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 font-semibold">{me&&!me.payments?'Payments coming soon':'Subscribe: $4.99/month'}</button>
   <form onSubmit={promo} className="flex gap-2"><input name="code" required placeholder="Promo code" aria-label="Promo code" className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-base"/><button disabled={busy} className="rounded-lg border border-slate-700 px-3">Apply</button></form></>}
  {msg&&<p className="text-sm text-amber-300" role="status">{msg}</p>}
  <p className="text-xs text-slate-500">Cancel anytime from Manage billing. For entertainment and research only; 21+. Gambling problem? Call 1-800-GAMBLER.</p></div>; }
