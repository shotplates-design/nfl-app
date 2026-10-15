// Presentational pieces shared by server pages and client explorers. No data imports here (keeps client bundles small).
import Link from 'next/link'; import FavButton from './FavButton';
export function Strip({r}:{r:any}){ return <span className="strip inline-flex gap-0.5 align-middle max-w-full" role="list" aria-label={`${r.hits} of ${r.games} games hit ${r.label}`}>
  {r.strip.map((g:any,i:number)=><span key={i} role="listitem" tabIndex={0} aria-label={`${g.d} ${g.o}: ${g.v} — ${g.h?'hit':'miss'}`}
   className={`tip relative w-5 h-5 rounded text-[9px] leading-5 text-center font-bold outline-none focus:ring-2 focus:ring-emerald-400 strip-pop ${g.h?'bg-emerald-600 text-white':'bg-slate-700 text-slate-300'}`} style={{animationDelay:`${i*60}ms`}} data-tip={`${g.d} ${g.o}: ${g.v}`}>{g.h?'✓':'✗'}</span>)}</span>; }
export function HitBar({hits,games}:{hits:number,games:number}){ const pct=games?Math.round(hits/games*100):0;
  return <span className="inline-flex items-center gap-2 min-w-0 sm:min-w-[90px]" aria-label={`Hit rate ${hits} of ${games} (${pct}%)`}><span className="h-1.5 w-14 rounded bg-slate-700 overflow-hidden"><span className={`block h-full grow-bar ${pct>=60?'bg-emerald-500':pct>=40?'bg-amber-400':'bg-rose-500'}`} style={{['--w' as any]:`${pct}%`}}/></span><span className="tabular-nums">{hits}/{games}</span></span>; }
export function HitRing({hits,games,size=56}:{hits:number,games:number,size?:number}){ const pct=games?hits/games:0; const r=22,c=2*Math.PI*r;
  return <svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={`Hit rate ${Math.round(pct*100)}%`}><circle cx="28" cy="28" r={r} className="stroke-slate-700" strokeWidth="6" fill="none"/>
   <circle cx="28" cy="28" r={r} className={`ring-anim ${pct>=.6?'stroke-emerald-500':pct>=.4?'stroke-amber-400':'stroke-rose-500'}`} strokeWidth="6" fill="none" strokeLinecap="round" transform="rotate(-90 28 28)" style={{strokeDasharray:c,['--off' as any]:c*(1-pct),strokeDashoffset:c*(1-pct)}}/>
   <text x="28" y="32" textAnchor="middle" fontSize="12" className="fill-white font-bold">{Math.round(pct*100)}%</text></svg>; }
export function TinyDots({r}:{r:any}){ const strip=Array.isArray(r?.strip)?r.strip:[];
  return <span className="dots" role="list" aria-label={`${r.hits} of ${r.games} games`}>{strip.map((g:any,i:number)=><span key={i} role="listitem" title={`${g.d||''} ${g.o||''}: ${g.v}`.trim()} className={`w-2 h-2 rounded-[2px] shrink-0 ${g.h?'bg-emerald-500':'bg-slate-600'}`}/>)}</span>; }
function Who({r,nolink}:{r:any,nolink?:boolean}){ const team=String(r.team||'').toUpperCase();
  const name=nolink?<span className="truncate font-semibold text-white min-w-0">{r.name}</span>:<Link href={`/players/${r.slug}`} className="truncate font-semibold min-w-0">{r.name}</Link>;
  return <span className="min-w-0 flex flex-col justify-center gap-px overflow-hidden leading-none">{name}{team?<span className="text-[10px] text-slate-500 truncate">{team}</span>:null}</span>; }
/** One player per row, 48px. kind=result is a prop search; kind=streak is a benchmark streak (top 10, groups, matchups). */
export function StreakLine({r,kind,rank,preview=false,nolink=false}:{r:any,kind:'result'|'streak',rank?:number,preview?:boolean,nolink?:boolean}){
  const hot=r.hot!==false;
  const label=`${rank?`Rank ${rank}, `:''}${r.name} ${String(r.team||'').toUpperCase()}${r.label?`, ${r.label}`:''}, ${r.hits}/${r.games}${r.avg!=null?`, avg ${Number(r.avg).toFixed(1)}`:''}, streak ${r.streak}`;
  return <div className={`srow ${kind==='result'?'result':rank?'ranked':'streak'}`} role="row" aria-label={label}>
    {rank!=null&&<span className="tabular-nums text-slate-400 text-center">{rank}</span>}
    <span>{!preview&&<FavButton slug={r.slug} name={r.name} compact/>}</span>
    <Who r={r} nolink={nolink}/>
    {kind==='streak'&&<span className="truncate text-slate-200">{r.label}</span>}
    {kind==='streak'&&<span className={`tabular-nums font-semibold ${hot?'text-emerald-400':'text-sky-300'}`}>{hot?'🔥':'🧊'}{r.streak}</span>}
    <span className="tabular-nums text-emerald-300">{r.hits}/{r.games}</span>
    {kind==='result'&&<span className="tabular-nums text-slate-300">{Number(r.avg).toFixed(1)}</span>}
    {kind==='result'&&<span className="tabular-nums text-slate-200">{r.streak}</span>}
    <TinyDots r={r}/>
  </div>; }
export function ResultList({rows}:{rows:any[]}){ if(!rows.length) return null;
  return <div className="slist min-w-0" role="table" aria-label="Search results">{rows.map(r=><StreakLine key={r.slug} r={r} kind="result"/>)}</div>; }
export function StreakTableView({rows,preview=false,nolink=false,ranked=false}:{rows:any[],preview?:boolean,nolink?:boolean,ranked?:boolean}){
  return <div className="slist min-w-0" role="table" aria-label={ranked?'Top 10 active streaks':'Streaks'}>{rows.map((r,i)=><StreakLine key={r.slug+(r.key||'')} r={r} kind="streak" rank={ranked?i+1:undefined} preview={preview} nolink={nolink}/>)}</div>; }
