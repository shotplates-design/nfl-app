const IMP:Record<string,string>={none:'bg-emerald-900/60 text-emerald-300',minor:'bg-amber-900/60 text-amber-300',major:'bg-rose-900/60 text-rose-300'};
const fmtU=(u?:string)=>u?new Date(u).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'';
export function WeatherBadge({w,updated,full}:{w:any,updated?:string,full?:boolean}){ if(!w) return null; const imp=w.impact||'none';
  const bits=w.indoor?['Indoors']:[w.temp_f!=null&&`${w.temp_f}°F`,w.wind_mph!=null&&`wind ${w.wind_mph} mph`,w.precip_pct!=null&&`${w.precip_pct}% precip`].filter(Boolean);
  return <div className="text-xs mt-1"><span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${IMP[imp]||IMP.none}`} title="Weather impact (forecast)">Weather: {imp}</span> <span className="text-slate-300">{bits.join(' · ')}</span>
   {full&&w.note&&<div className="text-slate-400 mt-0.5">{w.note}</div>}<div className="text-slate-500">Forecast{updated?` · updated ${fmtU(updated)}`:''}</div></div>; }
const RANK:Record<string,number>={out:0,doubtful:1,questionable:2,probable:3};
export function injuryBadge(status:string){ const s=String(status||'').toLowerCase();
  const tone=s==='out'?'bg-rose-900/80 text-rose-200':s==='doubtful'||s==='questionable'?'bg-amber-900/80 text-amber-200':s==='probable'?'bg-emerald-900/80 text-emerald-200':'bg-slate-800 text-slate-300';
  return <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status||'—'}</span>; }
function withWithout(v:any){ if(v==null||v==='') return null; const text=typeof v==='string'?v:Object.entries(v).map(([k,val])=>`${k}: ${val}`).join(' · ');
  return <p className="text-xs text-slate-300 mt-1 break-anywhere">{text}</p>; }
export function InjuryReport({list}:{list:any[]}){ const rows=[...(list||[])].sort((a,b)=>(RANK[String(a.status||'').toLowerCase()]??9)-(RANK[String(b.status||'').toLowerCase()]??9)||String(a.player||'').localeCompare(String(b.player||'')));
  if(!rows.length) return <p className="text-sm text-slate-500">No injuries reported.</p>;
  return <ul className="space-y-2">{rows.map((i,k)=><li key={k} className="card !p-3 min-w-0">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0"><span className="font-semibold break-anywhere">{i.player||i.name}</span>{(i.position||i.pos)&&<span className="text-xs text-slate-400">{i.position||i.pos}</span>}{injuryBadge(i.status)}</div>
    {i.injury&&<p className="text-sm text-slate-300 mt-1 break-anywhere">{i.injury}</p>}
    {withWithout(i.with_without)}
    {i.note&&<p className="text-xs text-slate-500 mt-1 break-anywhere">{i.note}</p>}
    {typeof i.source_url==='string'&&i.source_url.startsWith('https://')&&<a href={i.source_url} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 inline-block">Injury report</a>}
  </li>)}</ul>; }
export function Injuries({list,full}:{list:any[],full?:boolean}){ if(!list) return null;
  if(!list.length) return full?<p className="text-xs text-slate-500 mt-1">No injuries reported.</p>:null;
  if(full) return <div className="mt-2"><InjuryReport list={list}/></div>;
  const rows=list.slice(0,6);
  return <ul className="mt-1 flex flex-wrap gap-1">{rows.map((i:any,k:number)=><li key={k} className="text-[11px] rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 max-w-full break-anywhere">{injuryBadge(i.status)} <span className="text-slate-200">{i.player||i.name}</span></li>)}{list.length>rows.length&&<li className="text-[11px] text-slate-500 self-center">+{list.length-rows.length}</li>}</ul>; }
