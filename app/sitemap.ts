import { players, teamCodes, CAT_STATS, SITE, GROUPS } from '@/lib/data'; import articles from '@/data/articles.json';
export default function sitemap(){ const now=new Date(); const u=(p:string,priority=0.6)=>({url:SITE+p,lastModified:now,changeFrequency:'daily' as const,priority});
 return [u('/',1),u('/players',0.8),u('/teams',0.8),u('/matchups',0.8),u('/streaks',0.9),...Object.keys(GROUPS).map(g=>u('/streaks/'+g,0.8)),u('/leaders',0.8),u('/insights',0.8),...teamCodes().map(t=>u('/teams/'+t,0.7)),...Object.keys(CAT_STATS).map(c=>u('/leaders/'+c,0.7)),
 ...(articles as any[]).map(a=>u('/insights/'+a.slug,0.6)),...players.map(p=>u('/players/'+p.slug,p.games.length?0.6:0.3))]; }
