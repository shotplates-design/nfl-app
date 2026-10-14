import Link from 'next/link'; import { players, teamName } from '@/lib/data'; import articles from '@/data/articles.json'; import { Crumbs, JsonLd } from '@/lib/ui'; import { SITE } from '@/lib/data';
export const metadata={title:'NFL Matchups – Game Results & Player Stat Breakdowns',description:'Every NFL game in our data with final scores and links to player stat breakdowns for both teams.',alternates:{canonical:'/matchups'}};
type G={k:number,date:string,home:string,away:string,score:string};
function games(){ const m=new Map<string,G>();
 for(const p of players) for(const g of p.games){ const opp=g.opp.replace(/^(@|vs)/,'').toLowerCase(); const home=g.opp.startsWith('vs')?p.team:opp, away=g.opp.startsWith('vs')?opp:p.team;
  const key=`${g.k}-${home}-${away}`; if(m.has(key)) continue;
  // result is from p.team's perspective, e.g. "W26-14"; convert to "TEAM 26 – 14 TEAM"
  const r=/^([WLT])(\d+)-(\d+)(.*)$/.exec(g.result||''); let score=g.result||'';
  if(r){ const [hi,lo]=[+r[2],+r[3]]; const mine=r[1]==='L'?lo:hi, theirs=r[1]==='L'?hi:lo; const [o,t]=[p.team,opp];
   score=`${o.toUpperCase()} ${mine} – ${theirs} ${t.toUpperCase()}${r[4]}`; }
  m.set(key,{k:g.k,date:g.date,home,away,score}); }
 return [...m.values()].sort((a,b)=>b.k-a.k); }
export default function Page(){ const gs=games(); const A=articles as any[]; const byDate=new Map<string,G[]>(); gs.forEach(g=>{byDate.set(g.date,[...(byDate.get(g.date)||[]),g])});
 const link=(t:string,o:string)=>A.find(a=>a.kind==='matchup'&&a.team===t&&a.opp.toLowerCase()===o);
 return <><Crumbs items={[['Home','/'],['Matchups','/matchups']]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:'NFL matchups',url:`${SITE}/matchups`,numberOfItems:gs.length}}/>
 <h1>NFL Matchups</h1><p className="text-sm text-slate-400 mb-2">Our data has no upcoming schedule yet, so these are games already played ({gs.length} games), newest first. Tap a team for its stat breakdown.</p>
 {[...byDate.entries()].map(([d,list])=><section key={d}><h2>{d}</h2><ul className="grid sm:grid-cols-2 gap-2">{list.map(g=>{const ah=link(g.away,g.home), ha=link(g.home,g.away);
  return <li key={g.away+g.home} className="card !p-3 text-sm"><div className="font-semibold">{teamName(g.away)} @ {teamName(g.home)}</div><div className="text-slate-400">{g.score}</div>
  <div className="flex gap-3 mt-1">{ah&&<Link href={`/insights/${ah.slug}`}>{g.away.toUpperCase()} breakdown</Link>}{ha&&<Link href={`/insights/${ha.slug}`}>{g.home.toUpperCase()} breakdown</Link>}</div></li>})}</ul></section>)}</>; }
