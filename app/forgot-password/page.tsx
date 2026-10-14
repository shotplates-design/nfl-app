'use client'; import { useState } from 'react'; import Link from 'next/link';
export default function Forgot(){ const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e:any){ e.preventDefault(); setBusy(true); const email=new FormData(e.target).get('email');
  const r=await fetch('/api/password/forgot',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})}).catch(()=>null); const j=await r?.json().catch(()=>null);
  setBusy(false); setMsg(j?.message||'If that email has an account, we sent a password reset link.'); }
 return <form onSubmit={submit} className="card max-w-sm mx-auto space-y-3"><h1>Forgot password</h1><p className="text-sm text-slate-400">Enter your account email and we'll send a reset link.</p>
  <input name="email" type="email" required placeholder="Email" autoComplete="email" className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-base"/>
  <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 font-semibold">{busy?'…':'Send reset link'}</button>
  {msg&&<p role="status" className="text-sm text-emerald-300">{msg}</p>}<p className="text-sm text-slate-400"><Link href="/login">Back to log in</Link></p></form>; }
