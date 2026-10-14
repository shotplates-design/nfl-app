// "Best Props This Week". For each player whose team plays, pick the HIGHEST line they still clear in >=80% of games
// (a line set from their own game logs, rounded down), weight it by difficulty vs. the position's typical output,
// then pick a diverse top list. Every number comes from season game logs; lines are not sportsbook lines.
import { players } from './data'; import { currentWeek, fmtKick } from './matchups'; import { buildPgames, STATS } from './props.mjs';
export const MIN_RATE = 0.8;
export const SCORE_NOTE = `For each player we find the highest line they cleared in at least ${MIN_RATE*100}% of their games (3+ games), rounded down to a clean number (5-yard steps for yards). Score = 40 × hit rate + 30 × line difficulty + 4 per game of current streak (max 5) + 2 per game played (max 6). Line difficulty is the line divided by the typical per-game output at that position (the 75th-percentile per-game average among players at that position with 3+ games, i.e. a solid starter), capped at 1.5×; lines under 0.6× are skipped as too easy, so a 75-yard line for a receiver scores more than 4 receptions. The list then keeps variety: one prop per player, at most 2 per team, 3 per game and 2 defenders, and at least 3 each of QBs, RBs and WR/TEs where available.`;
// Props considered per position (carries and kicking left out).
const PROPS:Record<string,string[]>={QB:['passYds','passTd','rushYds'],RB:['rushYds','recYds','rec','rrTd'],'WR/TE':['recYds','rec','rrTd'],DEF:['tackles','sacks']};
const STEP=(k:string)=>/Yds$/.test(k)?5:1;
const pct=(a:number[],q:number)=>{const s=[...a].sort((x,y)=>x-y); return s.length? s[Math.min(s.length-1,Math.floor(q*s.length))]:0;};
const AREA=(k:string)=> k==='rushYds'?['Run defense'] : k==='rrTd'?['Rush TD prevention','Pass TD prevention'] : k==='passTd'?['Pass TD prevention','Pass coverage'] : ['passYds','recYds','rec'].includes(k)?['Pass coverage','Pass defense'] : [];
let PG:any=null;
export function candidates(){ const w=currentWeek(); const T:Record<string,any>={};
  for(const g of w.games){ const base={kick:fmtKick(g.kickoff),slug:g.slug,weather:g.cond?.weather}; const inj=(g.cond?.injuries||[]);
    T[g.awayCode]={...base,opp:g.homeCode,oppName:g.home,at:'@',oppStr:g.home_strengths||[],oppWeak:g.home_weaknesses||[],inj};
    T[g.homeCode]={...base,opp:g.awayCode,oppName:g.away,at:'vs',oppStr:g.away_strengths||[],oppWeak:g.away_weaknesses||[],inj}; }
  const pg=(PG ||= buildPgames(players)).p as any[];
  // positional norms: median per-game average among players with 3+ games
  const norm:Record<string,number>={};
  for(const [role,ks] of Object.entries(PROPS)) for(const k of ks){ const avgs=pg.filter(p=>p[3]===role).map(p=>p[4].filter((g:any)=>k in g[2]).map((g:any)=>g[2][k])).filter((v:number[])=>v.length>=3).map((v:number[])=>v.reduce((a,b)=>a+b,0)/v.length); norm[role+k]=pct(avgs.filter((x:number)=>x>0),0.75)||1; }
  const out:any[]=[];
  for(const [slug,name,team,role,games] of pg){ const t=T[team]; const ks=PROPS[role]; if(!t||!ks) continue;
    if(t.inj.some((i:any)=>(i.player||i.name)===name&&/^out|^ir|doubtful/i.test(i.status||''))) continue;
    let best:any=null;
    for(const k of ks){ const gs=games.filter((g:any)=>k in g[2]); if(gs.length<3) continue; const vals=gs.map((g:any)=>g[2][k]);
      const sorted=[...vals].sort((a,b)=>a-b); const miss=Math.floor(gs.length*(1-MIN_RATE)+1e-9); const st=STEP(k);
      const line=Math.floor(sorted[miss]/st)*st; if(line<1) continue;
      const strip=gs.map((g:any)=>({d:g[0],o:g[1],v:g[2][k],h:g[2][k]>=line})); const hits=strip.filter((s:any)=>s.h).length; const rate=hits/gs.length;
      let streak=0; for(let i=strip.length-1;i>=0&&strip[i].h;i--) streak++;
      const avg=vals.reduce((a:number,b:number)=>a+b,0)/vals.length; const diff=Math.min(line/norm[role+k],1.5); if(diff<0.6) continue; // too easy relative to a solid starter
      const score=40*rate+30*diff/1.5+4*Math.min(streak,5)+2*Math.min(gs.length,6);
      if(!best||score>best.score) best={k,line,strip,hits,games:gs.length,streak,avg,diff,score,norm:norm[role+k]}; }
    if(!best) continue;
    const lab=STATS[best.k][0];
    const why=[`Hit ${best.line}+ in ${best.hits}/${best.games} games`,`averaging ${best.avg.toFixed(1)}`,`line is ${best.diff.toFixed(2)}× the typical starting ${role} (${best.norm.toFixed(1)})`];
    if(best.streak>=2) why.push(`${best.streak} straight`);
    const area=AREA(best.k); const weak=area.find(a=>t.oppWeak.includes(a)), str=area.find(a=>t.oppStr.includes(a));
    if(weak) why.push(`${t.oppName} ${weak} is listed as a weakness in the matchup report`); else if(str) why.push(`caution: ${t.oppName} ${str} is listed as a strength`);
    if(t.weather&&!t.weather.indoor&&t.weather.impact&&t.weather.impact!=='none') why.push(`${t.weather.impact} weather impact forecast${t.weather.wind_mph!=null?` (wind ${t.weather.wind_mph} mph)`:''}`);
    out.push({slug,name,team,role,opp:t.opp,oppName:t.oppName,at:t.at,kick:t.kick,game:t.slug,prop:`Over ${best.line-0.5} ${lab}`,bench:`${best.line}+, set from his game logs`,
      hits:best.hits,games:best.games,streak:best.streak,avg:best.avg,thr:best.line,score:Math.round(best.score*10)/10,strip:best.strip.slice(-5),label:`${best.line}+ ${lab}`,why:why.join('; ')+'.'}); }
  return out.sort((a,b)=>b.score-a.score); }
export function bestProps(limit=18){ const all=candidates(); const pick:any[]=[]; const cnt=(f:(r:any)=>boolean)=>pick.filter(f).length;
  const ok=(r:any)=> cnt(x=>x.team===r.team)<2 && cnt(x=>x.game===r.game)<3 && (r.role!=='DEF'||cnt(x=>x.role==='DEF')<2) && cnt(x=>x.role===r.role)<6;
  for(const r of all){ if(pick.length>=limit) break; if(ok(r)) pick.push(r); }
  for(const role of ['QB','RB','WR/TE']){ while(cnt(x=>x.role===role)<3){ const c=all.find(r=>r.role===role&&!pick.includes(r)&&cnt(x=>x.team===r.team)<2); if(!c) break;
      const counts:Record<string,number>={}; pick.forEach(x=>counts[x.role]=(counts[x.role]||0)+1);
      const over=[...pick].reverse().find(x=>x.role!==role&&(counts[x.role]||0)>3); if(!over) break; pick.splice(pick.indexOf(over),1,c); } }
  return pick.sort((a,b)=>b.score-a.score); }
