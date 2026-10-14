import Link from 'next/link'; import { notFound } from 'next/navigation';
import { players, bySlug, CAT_STATS, CAT_LABEL, catGames, avg, fmt, teamName, SITE, streaksFor, bestHot } from '@/lib/data'; import LineToggle from '@/components/LineToggle'; import FavButton from '@/components/FavButton'; import { Crumbs, JsonLd, Bars, Strip, HitBar, BENCH_NOTE } from '@/lib/ui';
export const dynamicParams=false;
export function generateStaticParams(){ return players.map(p=>({slug:p.slug})); }
export function generateMetadata({params}:{params:{slug:string}}){ const p=bySlug(params.slug); if(!p) return {};
 const b=bestHot(p); const title=`${p.name} Stats, Game Log & Streaks ${p.season} (${p.team.toUpperCase()})`;
 const description=`${p.name} ${p.season} ${p.cat?CAT_LABEL[p.cat].toLowerCase():''} stats for the ${teamName(p.team)}: ${catGames(p).length} game log entries${b?`, ${b.streak} straight games with ${b.label} (${b.hits}/${b.games})`:''}. Prop-benchmark hit rates & splits by opponent.`;
 return {title,description,alternates:{canonical:`/players/${p.slug}`},openGraph:{title,description,url:`/players/${p.slug}`,type:'profile'}}; }
export default function Page({params}:{params:{slug:string}}){ const p=bySlug(params.slug); if(!p) notFound();
 const cat=p.cat; const stats=cat?CAT_STATS[cat]:[]; const gs=catGames(p); const st=streaksFor(p); const mk:any={}; st.forEach(r=>{const k=r.field+r.group; (mk[k] ||= {field:r.field,name:r.label.replace(/^\d+\+ /,'').replace(/ \(\d+\+\)$/,''),thr:[],games:r.strip.map((g:any)=>({d:g.d,o:g.o,v:g.v}))}).thr.push(r.thr)}); const markets=Object.values(mk); const l5=gs.slice(-5);
 const opp: Record<string,any[]> = {}; gs.forEach(g=>{(opp[g.opp.replace(/^(@|vs)/,'')] ||= []).push(g)});
 const mates=players.filter(x=>x.team===p.team&&x.slug!==p.slug&&x.cat===cat).slice(0,8);
 return <>
  <Crumbs items={[['Home','/'],[teamName(p.team),`/teams/${p.team}`],[p.name,`/players/${p.slug}`]]}/>
  <JsonLd data={{'@context':'https://schema.org','@type':'Person',additionalType:'https://schema.org/SportsPerson',name:p.name,url:`${SITE}/players/${p.slug}`,memberOf:{'@type':'SportsTeam',name:teamName(p.team),sport:'American Football',url:`${SITE}/teams/${p.team}`}}}/>
  <div className="flex items-center gap-3"><h1>{p.name}</h1><FavButton slug={p.slug} name={p.name}/><Link href={`/compare?a=${p.slug}`} className="text-xs ml-auto">Compare ⇄</Link></div><p className="text-sm text-slate-400"><Link href={`/teams/${p.team}`}>{teamName(p.team)}</Link> · {p.season} season{cat&&<> · {CAT_LABEL[cat]}</>}</p>
  {markets.length>0&&<><h2>Line explorer</h2><p className="text-xs text-slate-500 mb-2">Pick a quick line or set any number to see the hit rate update.</p><LineToggle markets={markets as any}/></>}
  {st.length>0&&<><h2>Streaks & hit rates vs benchmarks</h2><p className="text-xs text-slate-500 mb-2">{BENCH_NOTE}</p><div className="card overflow-x-auto"><table><thead><tr><th>Benchmark</th><th>Current streak</th><th>Hit rate</th><th>Game by game</th></tr></thead><tbody>
   {st.map(r=><tr key={r.key}><td>{r.label}</td><td className={r.hot?'text-emerald-400':'text-sky-300'}>{r.hot?'🔥 Hit':'🧊 Missed'} {r.streak} straight</td><td><HitBar hits={r.hits} games={r.games}/></td><td><Strip r={r}/></td></tr>)}</tbody></table></div>
   <p className="text-xs mt-1"><Link href={`/streaks/${st[0].group}`}>More {st[0].group} streaks →</Link></p></>}
  {gs.length>0&&<>
  <h2>Season averages</h2><div className="overflow-x-auto card"><table><thead><tr><th></th>{stats.map(s=><th key={s[0]}>{s[1]}</th>)}</tr></thead><tbody>
   <tr><td>Season avg ({gs.length} G)</td>{stats.map(s=><td key={s[0]}>{fmt(avg(gs,s[0]))}</td>)}</tr>
   <tr><td>Last {l5.length} avg</td>{stats.map(s=><td key={s[0]}>{fmt(avg(l5,s[0]))}</td>)}</tr>
</tbody></table></div>
  <h2>Chart</h2><Bars label={stats[0][1]} data={gs.map(g=>({x:g.opp,y:g[stats[0][0]]}))}/>
  <h2>Game log</h2><div className="overflow-x-auto card"><table><thead><tr><th>Date</th><th>Opp</th><th>Result</th>{stats.map(s=><th key={s[0]}>{s[1]}</th>)}</tr></thead>
   <tbody>{[...gs].reverse().map((g,i)=><tr key={i}><td>{g.date}</td><td>{g.opp}</td><td className={g.result?.startsWith('W')?'text-emerald-400':'text-rose-400'}>{g.result}</td>{stats.map(s=><td key={s[0]}>{fmt(g[s[0]])}</td>)}</tr>)}</tbody></table></div>
  <h2>Splits by opponent</h2><div className="overflow-x-auto card"><table><thead><tr><th>Opponent</th><th>G</th>{stats.slice(0,3).map(s=><th key={s[0]}>Avg {s[1]}</th>)}</tr></thead>
   <tbody>{Object.entries(opp).map(([o,arr])=><tr key={o}><td>{o}</td><td>{arr.length}</td>{stats.slice(0,3).map(s=><td key={s[0]}>{fmt(avg(arr,s[0]))}</td>)}</tr>)}</tbody></table></div></>}
  {gs.length===0&&<p className="mt-4 text-slate-400">No game log entries in our data yet for this player.</p>}
  {p.splits.length>0&&<><h2>Team division standings (as supplied)</h2><div className="overflow-x-auto card"><table><thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>PF</th><th>PA</th></tr></thead>
   <tbody>{p.splits.map((s,i)=><tr key={i}><td>{s.team}</td><td>{fmt(s.w)}</td><td>{fmt(s.l)}</td><td>{fmt(s.t)}</td><td>{fmt(s.pf)}</td><td>{fmt(s.pa)}</td></tr>)}</tbody></table></div></>}
  {mates.length>0&&<><h2>More {teamName(p.team)} {cat&&CAT_LABEL[cat].toLowerCase()} players</h2><ul className="flex flex-wrap gap-2 text-sm">{mates.map(m=><li key={m.slug}><Link href={`/players/${m.slug}`} className="card !p-2 block">{m.name}</Link></li>)}</ul></>}
  {cat&&<p className="mt-4 text-sm"><Link href={`/leaders/${cat}`}>See the {CAT_LABEL[cat].toLowerCase()} leaderboard →</Link></p>}
 </>; }
