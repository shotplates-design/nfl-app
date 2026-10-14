const IMP:Record<string,string>={none:'bg-emerald-900/60 text-emerald-300',minor:'bg-amber-900/60 text-amber-300',major:'bg-rose-900/60 text-rose-300'};
const fmtU=(u?:string)=>u?new Date(u).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET':'';
export function WeatherBadge({w,updated,full}:{w:any,updated?:string,full?:boolean}){ if(!w) return null; const imp=w.impact||'none';
  const bits=w.indoor?['Indoors']:[w.temp_f!=null&&`${w.temp_f}°F`,w.wind_mph!=null&&`wind ${w.wind_mph} mph`,w.precip_pct!=null&&`${w.precip_pct}% precip`].filter(Boolean);
  return <div className="text-xs mt-1"><span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${IMP[imp]||IMP.none}`} title="Weather impact (forecast)">Weather: {imp}</span> <span className="text-slate-300">{bits.join(' · ')}</span>
   {full&&w.note&&<div className="text-slate-400 mt-0.5">{w.note}</div>}<div className="text-slate-500">Forecast{updated?` · updated ${fmtU(updated)}`:''}</div></div>; }
export function Injuries({list,full}:{list:any[],full?:boolean}){ if(!list) return null;
  if(!list.length) return <div className="text-xs text-slate-500 mt-1">Injuries: none reported in feed</div>;
  return <div className="text-xs mt-1"><div className="font-semibold text-rose-300">Injuries</div><ul>{list.slice(0,full?99:4).map((i:any,k:number)=><li key={k}>{i.player||i.name} {i.team?`(${i.team}${i.pos?` ${i.pos}`:''})`:''} – <span className="text-amber-300">{i.status}</span>{full&&i.note?` · ${i.note}`:''}</li>)}{!full&&list.length>4&&<li className="text-slate-500">+{list.length-4} more</li>}</ul></div>; }
