'use client'; import { useState } from 'react'; import { signOut } from 'next-auth/react';
const inp='w-full rounded-lg bg-slate-800 px-3 py-2';
export default function AccountActions({billing}:{billing:boolean}){ const [msg,setMsg]=useState<[boolean,string]|null>(null); const [busy,setBusy]=useState(false);
 async function change(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); const form=e.currentTarget; const f=new FormData(form); const next=String(f.get('next')); 
  if(next.length<8) return setMsg([false,'New password must be at least 8 characters.']); if(next!==f.get('confirm')) return setMsg([false,'New passwords don’t match.']);
  setBusy(true); const r=await fetch('/api/password/change',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({current:f.get('current'),next})}); const j=await r.json().catch(()=>({})); setBusy(false);
  if(r.ok){ form.reset(); setMsg([true,'Password updated.']); } else setMsg([false,j.error||'Could not update password.']); }
 async function portal(){ const r=await fetch('/api/stripe/portal',{method:'POST'}); const j=await r.json().catch(()=>({})); if(r.ok&&j.url) location.href=j.url; else setMsg([false,j.error||'Billing portal unavailable.']); }
 return <><form onSubmit={change} className="card space-y-3"><h2 className="font-semibold">Change password</h2>
   <input name="current" type="password" required autoComplete="current-password" placeholder="Current password" aria-label="Current password" className={inp}/>
   <input name="next" type="password" required minLength={8} autoComplete="new-password" placeholder="New password (8+ chars)" aria-label="New password" className={inp}/>
   <input name="confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="Confirm new password" aria-label="Confirm new password" className={inp}/>
   {msg&&<p role="status" className={`text-sm ${msg[0]?'text-emerald-300':'text-red-400'}`}>{msg[1]}</p>}
   <button disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 font-semibold">{busy?'…':'Update password'}</button></form>
  {billing&&<button onClick={portal} className="w-full rounded-lg border border-slate-700 py-2">Manage billing</button>}
  <button onClick={()=>signOut({callbackUrl:'/'})} className="w-full rounded-lg border border-slate-700 py-2 text-slate-200">Log out</button></>; }
