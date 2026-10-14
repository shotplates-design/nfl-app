'use client'; import { useState } from 'react';
type U={email:string,created:number|null,status:string,sub:string|null};
export default function AdminUsers({users,me}:{users:U[],me:string}){ const [list,setList]=useState(users); const [msg,setMsg]=useState('');
 async function remove(email:string){ if(!confirm(`Remove ${email}? This deletes their account and cancels any active Stripe subscription.`)) return;
  const r=await fetch('/api/admin/users',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({email})}); const j=await r.json();
  if(r.ok){ setList(l=>l.filter(u=>u.email!==email)); setMsg(`Removed ${email}${j.canceled?' (subscription canceled)':''}.`); } else setMsg(j.error||'Failed'); }
 return <><p role="status" className="text-sm text-amber-300 min-h-5">{msg}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-400"><th className="py-1 pr-2">Email</th><th className="pr-2">Signed up</th><th className="pr-2">Status</th><th></th></tr></thead>
  <tbody>{list.map(u=><tr key={u.email} className="border-t border-slate-800"><td className="py-1.5 pr-2 break-all">{u.email}</td><td className="pr-2 whitespace-nowrap">{u.created?new Date(u.created).toLocaleDateString():'–'}</td>
   <td className="pr-2">{u.status}{u.sub&&u.status!=='paid'?` (${u.sub})`:''}</td><td>{u.email===me?<span className="text-xs text-slate-500">you</span>:<button onClick={()=>remove(u.email)} className="rounded border border-rose-700 px-2 py-0.5 text-rose-300">Remove</button>}</td></tr>)}</tbody></table></div></>; }
