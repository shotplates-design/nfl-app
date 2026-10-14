// "Best Props This Week": ranks benchmark-line props for players whose team plays this week.
// Every number comes from season game logs. Lines are our standard benchmarks, not sportsbook lines.
import { players, streaksFor } from './data'; import { currentWeek, fmtKick } from './matchups';
export const SCORE_NOTE = 'Score = 50 × hit rate + 5 per game of current streak (max 6) + 20 × margin of season average over the line (e.g. +50% = 10 points) + 2 per game played (max 6). Only props hit in at least 60% of 3+ games are considered; props where the average is more than double the line are skipped as too easy. Carries are left out. One prop per player, at most 4 defenders, and ties go to the higher line.';
const ROLE:Record<string,string>={passing:'QB',rushing:'RB',receiving:'WR/TE',defense:'DEF',kicking:'K'};
// Which defensive area of the opponent matters for each prop (labels from the supplied matchup report).
const AREA=(field:string,group:string)=> group==='rushing'? (field==='primTd'?['Rush TD prevention','Run defense']:['Run defense']) : group==='passing'||group==='receiving'? (field==='primTd'||field==='passTd'?['Pass TD prevention','Pass coverage','Pass defense']:['Pass coverage','Pass defense']) : [];
export function bestProps(limit=18){ const w=currentWeek(); const T:Record<string,any>={};
  for(const g of w.games){ const base={kick:fmtKick(g.kickoff),kickoff:g.kickoff,slug:g.slug,weather:g.cond?.weather}; const inj=(g.cond?.injuries||[]);
    T[g.awayCode]={...base,opp:g.homeCode,oppName:g.home,at:'@',oppStr:g.home_strengths||[],oppWeak:g.home_weaknesses||[],inj};
    T[g.homeCode]={...base,opp:g.awayCode,oppName:g.away,at:'vs',oppStr:g.away_strengths||[],oppWeak:g.away_weaknesses||[],inj}; }
  const out:any[]=[];
  for(const p of players){ const t=T[p.team]; if(!t) continue;
    if(t.inj.some((i:any)=>(i.player||i.name)===p.name&&/^out|^ir|doubtful/i.test(i.status||''))) continue;
    let best:any=null;
    for(const r of streaksFor(p)){ if(r.group==='kicking'||r.field==='car'||r.games<3) continue; const rate=r.hits/r.games; if(rate<0.6) continue;
      const vals=r.strip.map((s:any)=>s.v); const avg=vals.reduce((a:number,b:number)=>a+b,0)/vals.length; const margin=(avg-r.thr)/r.thr;
      if(margin>1) continue; // average more than double the line: too easy to be a useful prop
      const score=50*rate+5*Math.min(r.hot?r.streak:0,6)+20*Math.max(0,Math.min(margin,1))+2*Math.min(r.games,6);
      if(!best||score>best.score||(score===best.score&&r.thr>best.thr)) best={...r,avg,margin,score}; }
    if(!best) continue;
    const unit=best.label.replace(/^\d+\+ /,'').replace(/ \(\d+\+\)$/,'');
    const why:string[]=[`Hit in ${best.hits}/${best.games} games`, `averaging ${best.avg.toFixed(1)} (${best.avg>=best.thr?'+':''}${(best.avg-best.thr).toFixed(1)} vs the line)`];
    if(best.hot&&best.streak>=2) why.push(`${best.streak} straight`);
    const area=AREA(best.field,best.group); const weak=area.find(a=>t.oppWeak.includes(a)), str=area.find(a=>t.oppStr.includes(a));
    if(weak) why.push(`${t.oppName} ${weak} is listed as a weakness in the matchup report`); else if(str) why.push(`caution: ${t.oppName} ${str} is listed as a strength`);
    if(t.weather&&!t.weather.indoor&&t.weather.impact&&t.weather.impact!=='none') why.push(`${t.weather.impact} weather impact forecast${t.weather.wind_mph!=null?` (wind ${t.weather.wind_mph} mph)`:''}`);
    out.push({slug:p.slug,name:p.name,team:p.team,role:ROLE[p.cat||'']||'',opp:t.opp,oppName:t.oppName,at:t.at,kick:t.kick,game:t.slug,
      prop:`Over ${best.thr-0.5} ${unit}`, bench:`${best.thr}+`, hits:best.hits,games:best.games,streak:best.hot?best.streak:0,avg:best.avg,thr:best.thr,score:Math.round(best.score*10)/10,
      strip:best.strip.slice(-5),label:best.label,why:why.join('; ')+'.'}); }
  let d=0; return out.sort((a,b)=>b.score-a.score||b.hits/b.games-a.hits/a.games||b.thr-a.thr).filter(r=>r.role!=='DEF'||++d<=4).slice(0,limit); }
