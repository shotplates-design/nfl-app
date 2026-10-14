import Link from 'next/link';
import { SITE } from './data';
export function JsonLd({data}:{data:any}){ return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data)}}/>; }
export function Crumbs({items}:{items:[string,string][]}){ return <>
  <nav aria-label="Breadcrumb" className="text-xs text-slate-400 mb-3">{items.map(([n,h],i)=><span key={h}>{i>0&&' / '}{i<items.length-1?<Link href={h}>{n}</Link>:n}</span>)}</nav>
  <JsonLd data={{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map(([n,h],i)=>({'@type':'ListItem',position:i+1,name:n,item:SITE+h}))}}/></>; }
export function Bars({data,label}:{data:{x:string,y:number|null}[],label:string}){
  const vals=data.map(d=>d.y??0); const max=Math.max(1,...vals.map(Math.abs)); const w=Math.max(1,data.length);
  return <figure className="card"><figcaption className="text-xs text-slate-400 mb-2">{label} by game</figcaption>
    <svg viewBox={`0 0 ${w*40} 120`} className="w-full h-32" role="img" aria-label={`${label} per game chart`}>
      {data.map((d,i)=>{const h=(Math.abs(d.y??0)/max)*90;return <g key={i}><rect x={i*40+6} y={100-h} width={28} height={h} rx={3} className="fill-emerald-500"/>
      <text x={i*40+20} y={100-h-3} textAnchor="middle" className="fill-slate-200" fontSize="10">{d.y??'—'}</text>
      <text x={i*40+20} y={114} textAnchor="middle" className="fill-slate-400" fontSize="8">{d.x}</text></g>})}
    </svg></figure>; }
export function Strip({r}:{r:any}){ return <span className="inline-flex gap-0.5 align-middle" aria-label={`${r.hits} of ${r.games} games hit ${r.label}`}>
  {r.strip.map((g:any,i:number)=><span key={i} title={`${g.d} ${g.o}: ${g.v}`} className={`w-5 h-5 rounded text-[9px] leading-5 text-center font-bold ${g.h?'bg-emerald-600 text-white':'bg-slate-700 text-slate-300'}`}>{g.h?'✓':'✗'}</span>)}</span>; }
export function StreakTable({rows,showGroup=false}:{rows:any[],showGroup?:boolean}){ return <div className="card overflow-x-auto"><table><thead><tr><th>Player</th><th>Benchmark</th><th>Streak</th><th>Hit rate</th><th>Game by game (oldest → latest)</th></tr></thead><tbody>
  {rows.map(r=><tr key={r.slug+r.key}><td><Link href={`/players/${r.slug}`}>{r.name}</Link> <span className="text-slate-500 text-xs">{r.team.toUpperCase()}</span></td><td>{r.label}</td>
  <td className={r.hot?'text-emerald-400 font-semibold':'text-sky-300 font-semibold'}>{r.hot?'🔥':'🧊'} {r.streak} straight</td><td>{r.hits}/{r.games}</td><td><Strip r={r}/></td></tr>)}</tbody></table></div>; }
export const BENCH_NOTE = 'Thresholds are standard statistical benchmarks, not sportsbook lines. Past results do not guarantee future outcomes.';
