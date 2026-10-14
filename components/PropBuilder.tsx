'use client'; import { useEffect, useMemo, useState } from 'react'; import Link from 'next/link'; import Chips from './Chips'; import LineInput from './LineInput'; import { Strip, HitBar } from './StreakView'; import FavButton from './FavButton';
import { STATS, ROLES, POS_STATS, normalizeQuery, runQuery, DEFAULT_Q } from '@/lib/props.mjs';
const SCOPES:[string,string][]=[['season','Every game this season'],['last','Each of last N games'],['streak','Current streak ≥ N'],['rate','Hit rate ≥ N%']];
const MAXL:Record<string,number>={recYds:200,rushYds:200,passYds:450,rec:15,tgts:15,car:30,rrTd:3,passTd:5,cmp:40,passAtt:50,int:3,tackles:15,sacks:4,fgm:5};
let cache:any=null;
function fromUrl(init:any){ if(typeof window==='undefined') return init; const u=new URLSearchParams(location.search); const q:any={...init};
  for(const k of Object.keys(DEFAULT_Q)){ const v=u.get(k); if(v!=null) q[k]=['line','n'].includes(k)?+v:v; } return normalizeQuery(q); }
export default function PropBuilder({initial=DEFAULT_Q,syncUrl=true}:{initial?:any,syncUrl?:boolean}){
  const [q,setQ]=useState<any>(()=>normalizeQuery(initial)); const [pg,setPg]=useState<any>(cache); const [lim,setLim]=useState(50);
  useEffect(()=>{ if(syncUrl) setQ(fromUrl(initial)); if(!cache) fetch('/pgames.json').then(r=>r.json()).then(d=>{cache=d;setPg(d)}); },[]);
  useEffect(()=>{ if(!syncUrl) return; const u=new URLSearchParams(Object.entries(q).map(([k,v])=>[k,String(v)])); history.replaceState(null,'',`${location.pathname}?${u}`); },[q,syncUrl]);
  const set=(k:string)=>(v:any)=>{ setLim(50); setQ((o:any)=>{ const n={...o,[k]:v}; if(k==='stat') n.line=STATS[v][3]; if(k==='pos'&&!POS_STATS[v].includes(o.stat)){ n.stat=POS_STATS[v][0]; n.line=STATS[n.stat][3]; } return n; }); };
  const rows=useMemo(()=>pg?runQuery(pg,q):[],[pg,q]); const [lab]=STATS[q.stat];
  const share=()=>{ const url=location.href; (navigator as any).share?(navigator as any).share({url,title:'BetStats prop search'}).catch(()=>{}):navigator.clipboard?.writeText(url); };
  const desc=`${q.pos==='any'?'Players':q.pos} ${q.dir==='under'?'under':'with'} ${q.line}${q.dir==='under'?'':'+'} ${lab.toLowerCase()} ${q.scope==='season'?`in every game this season (min ${q.n} games)`:q.scope==='last'?`in each of their last ${q.n} games`:q.scope==='streak'?`in ${q.n}+ straight games (active)`:`in ${q.n}%+ of games`}`;
  return <div className="card"><h2 className="!mt-0">Prop search builder</h2>
   <div className="text-xs text-slate-400">1. Position</div><Chips label="Position" options={ROLES as any} value={q.pos} onChange={set('pos')}/>
   <label className="text-xs text-slate-400" htmlFor="pb-stat">2. Stat</label>
   <select id="pb-stat" value={q.stat} onChange={e=>set('stat')(e.target.value)} className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-2 text-sm mb-1">{POS_STATS[q.pos].map((k:string)=><option key={k} value={k}>{STATS[k][0]}</option>)}</select>
   <Chips label="Over / under" options={[['over','Over (≥ line)'],['under','Under (< line)']]} value={q.dir} onChange={set('dir')}/>
   <LineInput value={q.line} onChange={set('line')} max={MAXL[q.stat]||100} step={q.stat.endsWith('Yds')?5:1} label={lab}/>
   <Chips label="Scope" options={SCOPES} value={q.scope} onChange={set('scope')}/>
   <LineInput value={q.n} onChange={set('n')} max={q.scope==='rate'?100:8} step={q.scope==='rate'?5:1} label={q.scope==='rate'?'Min %':q.scope==='season'?'Min games':'N games'}/>
   <div className="flex flex-wrap items-center gap-x-4"><Chips label="Sort" options={[['streak','Streak'],['rate','Hit rate'],['avg','Average'],['name','Name']]} value={q.sort} onChange={set('sort')}/>
    {syncUrl&&<button type="button" onClick={share} className="text-xs rounded-full border border-slate-700 px-3 py-1">🔗 Share query</button>}</div>
   <p className="text-sm mt-2" aria-live="polite"><strong>{pg?rows.length:'…'}</strong> {desc}</p>
   {!pg?<p className="text-xs text-slate-500">Loading game logs…</p>:rows.length?<div className="overflow-x-auto mt-2"><table><thead><tr><th><span className="sr-only">Watch</span></th><th>Player</th><th>Hits</th><th>Avg</th><th>Streak</th><th>Game by game</th></tr></thead><tbody>
    {rows.slice(0,lim).map((r:any)=><tr key={r.slug} className="fade-in"><td><FavButton slug={r.slug} name={r.name}/></td><td><Link href={`/players/${r.slug}`}>{r.name}</Link> <span className="text-slate-500 text-xs">{r.team.toUpperCase()} · {r.role}</span></td>
     <td><HitBar hits={r.hits} games={r.games}/></td><td className="tabular-nums">{r.avg.toFixed(1)}</td><td>{r.streak}</td><td><Strip r={{...r,label:`${q.dir==='under'?'under ':''}${q.line}${q.dir==='under'?'':'+'} ${lab}`}}/></td></tr>)}</tbody></table>
    {rows.length>lim&&<button type="button" onClick={()=>setLim(l=>l+50)} className="text-xs mt-2 rounded-full border border-slate-700 px-3 py-1">Show more ({rows.length-lim} left)</button>}</div>:<p className="text-sm text-slate-400 mt-2">No players match. Try a lower line or smaller N.</p>}
   <p className="text-xs text-slate-500 mt-2">Over counts a game when the stat is at or above your line. Lines are your own numbers, not sportsbook lines. Position comes from each player's main stat category (WR and TE are grouped). QB carries are included, but the data has no QB rushing yards.</p></div>; }
