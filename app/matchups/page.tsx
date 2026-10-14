import WeekView from '../WeekView'; import { currentWeek } from '@/lib/matchups'; import { Crumbs, JsonLd } from '@/lib/ui'; import { SITE } from '@/lib/data';
export function generateMetadata(){ const w=currentWeek(); const title=`NFL Week ${w.week} Matchups ${w.season} – Player Streaks & Hit Rates for Every Game`;
 const description=`Every NFL Week ${w.week} game with kickoff times and the hottest player prop streaks on both sides: ${w.games.slice(0,3).map(g=>`${g.away} @ ${g.home}`).join(', ')} and more.`;
 return {title,description,alternates:{canonical:'/matchups'},openGraph:{title,description,url:'/matchups'}}; }
export default function Page(){ const w=currentWeek(); return <><Crumbs items={[['Home','/'],['Matchups','/matchups']]}/>
 <JsonLd data={{'@context':'https://schema.org','@type':'ItemList',name:`NFL Week ${w.week} matchups`,itemListElement:w.games.map((g,i)=>({'@type':'ListItem',position:i+1,url:`${SITE}/matchups/${g.slug}`,name:`${g.away} at ${g.home}`}))}}/><WeekView/></>; }
