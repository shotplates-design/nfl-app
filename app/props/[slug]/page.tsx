import Link from 'next/link'; import { notFound } from 'next/navigation';
import { players, bySlug, CAT_STATS, CAT_LABEL, catGames, avg, fmt, teamName, SITE, bestHot } from '@/lib/data'; import { Crumbs, JsonLd } from '@/lib/ui';
// Public, indexable SEO page. Deliberately a LIMITED summary (season + last-5 averages, one top streak). No game log, no line explorer,
// no Best Props data; full player pages stay behind sign-in.
export const revalidate=3600; export const dynamicParams=true;
export function generateStaticParams(){ return players.filter(p=>p.games.length).slice(0,200).map(p=>({slug:p.slug})); }
export function generateMetadata({params}:{params:{slug:string}}){ const p=bySlug(params.slug); if(!p) return {};
 const title={absolute:`${p.name} player props stats & hit rates | ThePlayerProps`}; const b=bestHot(p);
 const description=`${p.name} (${teamName(p.team)}) ${p.season} player prop stats: season and last-5 averages${b?`, ${b.streak} straight games with ${b.label}`:''}. Hit rates, streaks and prop research at ThePlayerProps.`;
 return {title,description,alternates:{canonical:`/props/${p.slug}`},robots:{index:true,follow:true},openGraph:{title:title.absolute,description,url:`/props/${p.slug}`,type:'profile'}}; }
export default function Page({params}:{params:{slug:string}}){ const p=bySlug(params.slug); if(!p) notFound();
 const cat=p.cat; const stats=(cat?CAT_STATS[cat]:[]).slice(0,4); const gs=catGames(p); const l5=gs.slice(-5); const b=bestHot(p);
 const mates=players.filter(x=>x.team===p.team&&x.slug!==p.slug&&x.cat===cat&&x.games.length).slice(0,8);
 return <>
  <Crumbs items={[['Home','/'],[p.name,`/props/${p.slug}`]]}/>
  <JsonLd data={{'@context':'https://schema.org','@type':'Person',additionalType:'https://schema.org/SportsPerson',name:p.name,url:`${SITE}/props/${p.slug}`,memberOf:{'@type':'SportsTeam',name:teamName(p.team),sport:'American Football'}}}/>
  <h1>{p.name} player props stats & hit rates</h1>
  <p className="text-sm text-slate-400">{teamName(p.team)} · {p.season} season{cat&&<> · {CAT_LABEL[cat]}</>}</p>
  {b&&<div className="card mt-3"><p className="text-sm">🔥 <strong>{b.streak} straight games</strong> with {b.label} ({b.hits}/{b.games} this season)</p></div>}
  {gs.length>0&&stats.length>0?<><h2>Averages</h2><div className="overflow-x-auto card"><table><thead><tr><th></th>{stats.map(s=><th key={s[0]}>{s[1]}</th>)}</tr></thead><tbody>
   <tr><td>Season ({gs.length} G)</td>{stats.map(s=><td key={s[0]}>{fmt(avg(gs,s[0]))}</td>)}</tr>
   <tr><td>Last {l5.length}</td>{stats.map(s=><td key={s[0]}>{fmt(avg(l5,s[0]))}</td>)}</tr></tbody></table></div></>:<p className="mt-4 text-slate-400">No game log entries in our data yet for this player.</p>}
  <div className="card mt-4 text-center space-y-2"><p className="text-sm">See {p.name}'s full game log, every prop hit rate, streaks and splits by opponent.</p>
   <Link href={`/signup?callbackUrl=/players/${p.slug}`} className="inline-block rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white no-underline">Sign up for full access</Link></div>
  {mates.length>0&&<><h2>More {teamName(p.team)} player props</h2><ul className="flex flex-wrap gap-2 text-sm">{mates.map(m=><li key={m.slug}><Link href={`/props/${m.slug}`} className="card !p-2 block">{m.name}</Link></li>)}</ul></>}
 </>; }
