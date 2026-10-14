'use client';
export default function Chips({label,options,value,onChange}:{label:string,options:[any,string][],value:any,onChange:(v:any)=>void}){
  return <div role="radiogroup" aria-label={label} className="flex gap-2 overflow-x-auto no-scrollbar py-1">{options.map(([v,l])=><button key={String(v)} type="button" role="radio" aria-checked={value===v} onClick={()=>onChange(v)}
   className={`shrink-0 rounded-full px-3 py-1 text-xs border transition-colors ${value===v?'bg-emerald-600 border-emerald-500 text-white':'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}>{l}</button>)}</div>; }
