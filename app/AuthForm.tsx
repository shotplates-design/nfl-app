'use client'; import { useState } from 'react'; import { signIn } from 'next-auth/react'; import Link from 'next/link';
export default function AuthForm({mode}:{mode:'login'|'signup'}){ const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e:any){ e.preventDefault(); setErr(''); setBusy(true); const f=new FormData(e.target); const email=String(f.get('email')), password=String(f.get('password'));
  if(mode==='signup'){ const r=await fetch('/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,name:f.get('name')})}); const j=await r.json(); if(!r.ok){setErr(j.error);setBusy(false);return;} }
  const r=await signIn('credentials',{email,password,redirect:false}); setBusy(false); if(r?.ok) { const c=new URLSearchParams(location.search).get('callbackUrl')||''; location.href=mode==='signup'?'/subscribe':(c.startsWith('/')&&!c.startsWith('//')?c:'/'); } else setErr('Invalid email or password (or accounts not configured).'); }
 const inp="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-base";
 return <form onSubmit={submit} className="card max-w-sm mx-auto space-y-3"><h1>{mode==='login'?'Log in':'Create account'}</h1>
  {mode==='signup'&&<input name="name" placeholder="Name (optional)" className={inp}/>}
  <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inp}/>
  <input name="password" type="password" required minLength={8} placeholder="Password (8+ chars)" autoComplete={mode==='login'?'current-password':'new-password'} className={inp}/>
  {err&&<p className="text-rose-400 text-sm">{err}</p>}
  {mode==='login'&&<p className="text-sm text-right"><Link href="/forgot-password">Forgot password?</Link></p>}
  <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 font-semibold">{busy?'…':mode==='login'?'Log in':'Sign up'}</button>
  <p className="text-sm text-slate-400">{mode==='login'?<>New here? <Link href="/signup">Create an account</Link></>:<>Have an account? <Link href="/login">Log in</Link></>}</p></form>; }
