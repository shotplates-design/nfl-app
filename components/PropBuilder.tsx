'use client'; import { useEffect, useState } from 'react'; import Link from 'next/link'; import Chips from './Chips'; import LineInput from './LineInput'; import { Strip, HitBar } from './StreakView'; import FavButton from './FavButton'; import MemberLock from './MemberLock'; import { shareResultsImage } from './shareImage';
import { STATS, ROLES, POS_STATS, normalizeQuery, DEFAULT_Q } from '@/lib/props.mjs';
const SCOPES:[string,string][]=[['season','Every game this season'],['last','Each of last N games'],['streak','Current streak ≥ N'],['rate','Hit rate ≥ N%']];
const MAXL:Record<string,number>={recYds:200,rushYds:200,passYds:450,rec:15,tgts:15,car:30,rrTd:3,passTd:5,cmp:40,passAtt:50,int:3,tackles:15,sacks:4,fgm:5};
function fromUrl(init:any){ if(typeof window==='undefined') return init; const u=new URLSearchParams(location.search); const q:any={...init};
  for(const k of Object.keys(DEFAULT_Q)){ const v=u.get(k); if(v!=null) q[k]=['line','n'].includes(k)?+v:v; } return normalizeQuery(q); }
export default function PropBuilder({initial=DEFAULT_Q,syncUrl=true,preloaded,startEmpty=false}:{initial?:any,syncUrl?:boolean,preloaded?:any,startEmpty?:boolean}){
  const [skip,setSkip]=useState(!!preloaded||startEmpty);
  const [q,setQ]=useState<any>(()=>normalizeQuery(initial)); const [res,setRes]=useState<any>(null); const [lim,setLim]=useState(50); const [ready,setReady]=useState(!syncUrl);
  // startEmpty: opening the page must not POST the default query (that search counts for free accounts). A URL that already
  // has a query is an explicit search and still runs. Do not write the default query into the URL before that, or a refresh would count.
  useEffect(()=>{ if(!syncUrl) return; const explicit=startEmpty&&location.search.length>1; setQ(fromUrl(initial)); if(explicit) setSkip(false); setReady(true); },[]);
  useEffect(()=>{ if(!ready||skip) return; let on=true; const t=setTimeout(()=>{ fetch('/api/streaksearch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({q})}).then(r=>r.json()).then(j=>{ if(on) setRes(j); }).catch(()=>{}); },700); return ()=>{on=false;clearTimeout(t)}; },[q,ready,skip]);
  useEffect(()=>{ if(!syncUrl||(startEmpty&&skip)) return; const u=new URLSearchParams(Object.entries(q).map(([k,v])=>[k,String(v)])); history.replaceState(null,'',`${location.pathname}?${u}`); },[q,syncUrl,skip,startEmpty]);
  const set=(k:string)=>(v:any)=>{ setLim(50); setSkip(false); setQ((o:any)=>{ const n={...o,[k]:v}; if(k==='stat') n.line=STATS[v][3]; if(k==='pos'&&!POS_STATS[v].includes(o.stat)){ n.stat=POS_STATS[v][0]; n.line=STATS[n.stat][3]; } return n; }); };
  const cur=skip?preloaded:res; const rows:any[]=cur?.rows||[]; const pg=cur&&!cur.locked; const idle=startEmpty&&skip&&!preloaded; const [lab]=STATS[q.stat];
  const share=()=>{ const url=location.href; (navigator as any).share?(navigator as any).share({url,title:'ThePlayerProps prop search'}).catch(()=>{}):navigator.clipboard?.writeText(url); };
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
    {syncUrl&&<button type="button" onClick={share} className="text-xs rounded-full border border-slate-700 px-3 py-1">🔗 Share query</button>}
    {pg&&rows.length>0&&<button type="button" onClick={()=>shareResultsImage(desc,rows.slice(0,8))} className="text-xs rounded-full border border-emerald-600 text-emerald-300 px-3 py-1">📸 Share image</button>}</div>
   {typeof cur?.left==='number'&&<p className="text-xs text-amber-200 mt-2" aria-live="polite">{cur.left} of 10 free searches left</p>}
   {idle?<p className="text-sm text-slate-400 mt-2">Change a setting to search. Free searches are limited to 10.</p>:cur?.locked?<MemberLock title={cur.signedIn?"You've used your 10 free prop searches":'Prop search is for signed-in accounts'} signedIn={cur.signedIn}/>:<>
   <p className="text-sm mt-2" aria-live="polite"><strong>{pg?rows.length:'…'}</strong> {desc}</p>
   {!pg?<p className="text-xs text-slate-500">Searching…</p>:rows.length?<div className="overflow-x-auto mt-2"><table><thead><tr><th><span className="sr-only">Watch</span></th><th>Player</th><th>Hits</th><th>Avg</th><th>Streak</th><th>Game by game</th></tr></thead><tbody>
    {rows.slice(0,lim).map((r:any)=><tr key={r.slug} className="fade-in"><td><FavButton slug={r.slug} name={r.name}/></td><td><Link href={`/players/${r.slug}`}>{r.name}</Link> <span className="text-slate-500 text-xs">{r.team.toUpperCase()} · {r.role}</span></td>
     <td><HitBar hits={r.hits} games={r.games}/></td><td className="tabular-nums">{r.avg.toFixed(1)}</td><td>{r.streak}</td><td><Strip r={{...r,label:`${q.dir==='under'?'under ':''}${q.line}${q.dir==='under'?'':'+'} ${lab}`}}/></td></tr>)}</tbody></table>
    {rows.length>lim&&<button type="button" onClick={()=>setLim(l=>l+50)} className="text-xs mt-2 rounded-full border border-slate-700 px-3 py-1">Show more ({rows.length-lim} left)</button>}</div>:<p className="text-sm text-slate-400 mt-2">No players match. Try a lower line or smaller N.</p>}</>}
   <p className="text-xs text-slate-500 mt-2">Over counts a game when the stat is at or above your line. Lines are your own numbers, not sportsbook lines. Position comes from each player's main stat category (WR and TE are grouped).</p></div>; }
