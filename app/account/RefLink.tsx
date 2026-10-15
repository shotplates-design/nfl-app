'use client'; import { useState } from 'react';
export default function RefLink({code,count}:{code:string|null,count:number}){ const [ok,setOk]=useState(false); if(!code) return null;
 const url=`https://theplayerprops.com/signup?ref=${code}`;
 const share=()=>{ const n:any=navigator; if(n.share) n.share({title:'ThePlayerProps',text:'NFL prop streaks & hit rates — sign up free:',url}).catch(()=>{}); else n.clipboard?.writeText(url).then(()=>setOk(true)); };
 return <div className="card space-y-2 text-sm"><h2 className="!mt-0">Invite friends, get free months</h2>
  <p className="text-slate-400">Every friend who signs up with your link gives you 1 free month of full access.</p>
  <input readOnly value={url} onFocus={e=>e.target.select()} className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-2 text-xs"/>
  <button type="button" onClick={share} className="w-full rounded-lg bg-emerald-600 py-2 font-semibold">{ok?'Copied!':'Share my link'}</button>
  <p className="text-xs text-slate-500">{count} friend{count===1?'':'s'} joined so far.</p></div>; }
