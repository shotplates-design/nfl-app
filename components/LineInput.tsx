'use client';
/** Free-number line: slider + numeric input. */
export default function LineInput({value,onChange,max=200,step=1,label='Line'}:{value:number,onChange:(v:number)=>void,max?:number,step?:number,label?:string}){
  return <div className="flex items-center gap-2 py-1"><label className="text-xs text-slate-400 shrink-0" htmlFor="line-num">{label}</label>
   <input aria-label={`${label} slider`} type="range" min={0} max={Math.max(max,value)} step={step} value={value} onChange={e=>onChange(+e.target.value)} className="w-full accent-emerald-500"/>
   <input id="line-num" type="number" inputMode="decimal" min={0} step={step} value={value} onChange={e=>onChange(e.target.value===''?0:+e.target.value)} className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"/></div>; }
