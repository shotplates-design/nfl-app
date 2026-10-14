'use client'; import { useState } from 'react'; import Link from 'next/link';
export default function Reset(){ const [msg,setMsg]=useState(''); const [ok,setOk]=useState(false); const [busy,setBusy]=useState(false);
 async function submit(e:any){ e.preventDefault(); const f=new FormData(e.target); const password=String(f.get('password')); if(password!==String(f.get('confirm'))){ setMsg('Passwords do not match.'); return; }
  setBusy(true); const token=new URLSearchParams(location.search).get('token')||'';
  const r=await fetch('/api/password/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,password})}); const j=await r.json().catch(()=>({}));
  setBusy(false); if(r.ok){ setOk(true); setMsg('Password updated. You can log in now.'); } else setMsg(j.error||'Something went wrong.'); }
 const inp="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-base";
 return <form onSubmit={submit} className="card max-w-sm mx-auto space-y-3"><h1>Choose a new password</h1>
  {!ok&&<><input name="password" type="password" required minLength={8} placeholder="New password (8+ chars)" autoComplete="new-password" className={inp}/>
  <input name="confirm" type="password" required minLength={8} placeholder="Confirm new password" autoComplete="new-password" className={inp}/>
  <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 font-semibold">{busy?'…':'Update password'}</button></>}
  {msg&&<p role="status" className={`text-sm ${ok?'text-emerald-300':'text-rose-400'}`}>{msg}</p>}
  <p className="text-sm text-slate-400">{ok?<Link href="/login">Log in →</Link>:<Link href="/forgot-password">Request a new link</Link>}</p></form>; }
