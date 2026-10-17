import { players, SITE } from '@/lib/data'; import { weeks } from '@/lib/matchups';
// Only URLs a signed-out visitor (and Googlebot) can actually load; gated pages redirect to /signup (see middleware.ts) and are left out.
// lastModified is set only where the data carries a real date; otherwise it is omitted.
type Entry={url:string;lastModified?:string;changeFrequency:'daily';priority:number};
const day=(s?:string|null)=>{ if(!s) return undefined; const d=new Date(s); return isNaN(+d)?undefined:d.toISOString().slice(0,10); };
const latest=(xs:(string|undefined)[])=>xs.filter(Boolean).sort().at(-1);
// games[].k is MMDD of the game; Jan-Feb games belong to season+1.
const lastGame=(p:any)=>{ const k=p.games.at(-1)?.k; if(typeof k!=='number'||!p.season) return undefined; const m=Math.floor(k/100), d=k%100; const y=m<3?p.season+1:p.season; return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; };
export default function sitemap(): Entry[] {
  const u=(p:string,priority=0.6,lastModified?:string):Entry=>({url:SITE+p,...(lastModified?{lastModified}:{}),changeFrequency:'daily',priority});
  const ws=weeks(); const games=ws.flatMap(w=>w.games.map(g=>({w,g})));
  const gameDate=({w,g}:typeof games[number])=>day(g.condUpdated)||day(w.schedule_checked);
  const latestGame=latest(games.map(gameDate));
  return [u('/',1),u('/matchups',1,latestGame),u('/injuries',0.9),u('/matchups/results',0.5),
    ...games.map(x=>u('/matchups/'+x.g.slug,0.9,gameDate(x))),
    ...players.filter(p=>p.games.length).map(p=>u('/props/'+p.slug,0.7,lastGame(p)))]; }
