// "Best Props This Week". For each player whose team plays, pick the HIGHEST line they still clear in >=80% of games
// (a line set from their own game logs, rounded down), weight it by difficulty vs. the position's typical output,
// then pick a diverse top list. Every number comes from season game logs; lines are not sportsbook lines.
import { players } from './data'; import { currentWeek, fmtKick } from './matchups'; import { buildPgames, STATS } from './props.mjs'; import { loadInjuryDesk } from './injuryAnalysis'; import { injuryBlurb } from './injuryWhy.mjs';
let DESK: ReturnType<typeof loadInjuryDesk> | undefined;
const desk = () => DESK === undefined ? (DESK = loadInjuryDesk()) : DESK;
function withInjury(why: string[], name: string, team: string) {
  const b = injuryBlurb(desk(), { name, team });
  if (b?.clause) why.push(b.clause);
  return b?.note ?? null;
}
export const MIN_RATE = 0.8;
export const SCORE_NOTE = `For each QB, RB and WR/TE we find the highest line he cleared in at least ${MIN_RATE*100}% of his games (3+ games), or in 70% of games when that allows a line at least 10% higher and nearer his median, rounded down to a clean number (5-yard steps for yards). Props must be yardage, 5+ receptions (WR/TE), 3+ receptions (RB) or 2+ pass TD; defensive props are not listed. Score = 40 × hit rate + 30 × line difficulty + 4 per game of current streak (max 5) + 2 per game played (max 6) + 10 for yardage props. Line difficulty is the line divided by the typical per-game output at that position (the 75th-percentile per-game average among players at that position with 3+ games, i.e. a solid starter), capped at 1.5×; lines under 0.6× are skipped as too easy, so a 75-yard line for a receiver scores more than 4 receptions. The list then keeps variety: one prop per player, at most 2 per team and 3 per game, and at least 3 each of QBs, RBs and WR/TEs where available.`;
// Props considered per position (carries and kicking left out).
const PROPS:Record<string,string[]>={QB:['passYds','passTd','rushYds'],RB:['rushYds','recYds','rec'],'WR/TE':['recYds','rec'],DEF:['tackles']};
// Best Props: defenders excluded from the list entirely; minimum lines so easy props can't surface.
const BEST_PROPS:Record<string,string[]>={QB:['passYds','passTd','rushYds'],RB:['rushYds','recYds','rec'],'WR/TE':['recYds','rec']};
const MIN_LINE=(role:string,k:string)=> k==='rec'?(role==='WR/TE'?5:3) : k==='passTd'?2 : /Yds$/.test(k)?10 : 1;
const YARDS_BONUS=10, ALT_RATE=0.7;
/** Pick a line: the 80%-hit line, or the 70%-hit line if it is at least 10% higher; whichever is nearer the player's median wins ties. */
function pickLine(vals:number[],k:string,rate:number){ const s=[...vals].sort((a,b)=>a-b); const st=STEP(k); const at=(r:number)=>Math.floor(s[Math.floor(s.length*(1-r)+1e-9)]/st)*st;
  const a=at(rate), b=at(Math.min(rate,ALT_RATE)); const med=s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2;
  return (b>=a*1.1 && Math.abs(med-b)<=Math.abs(med-a)) ? b : a; }
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
  for(const [slug,name,team,role,games] of pg){ const t=T[team]; const ks=BEST_PROPS[role]; if(!t||!ks) continue;
    if(t.inj.some((i:any)=>(i.player||i.name)===name&&/^out|^ir|doubtful/i.test(i.status||''))) continue;
    let best:any=null;
    for(const k of ks){ const gs=games.filter((g:any)=>k in g[2]); if(gs.length<3) continue; const vals=gs.map((g:any)=>g[2][k]);
      const line=pickLine(vals,k,MIN_RATE); if(line<MIN_LINE(role,k)) continue;
      const strip=gs.map((g:any)=>({d:g[0],o:g[1],v:g[2][k],h:g[2][k]>=line})); const hits=strip.filter((s:any)=>s.h).length; const rate=hits/gs.length;
      let streak=0; for(let i=strip.length-1;i>=0&&strip[i].h;i--) streak++;
      const avg=vals.reduce((a:number,b:number)=>a+b,0)/vals.length; const diff=Math.min(line/norm[role+k],1.5); if(diff<0.6) continue; // too easy relative to a solid starter
      const score=40*rate+30*diff/1.5+4*Math.min(streak,5)+2*Math.min(gs.length,6)+(/Yds$/.test(k)?YARDS_BONUS:0);
      if(!best||score>best.score) best={k,line,strip,hits,games:gs.length,streak,avg,diff,score,norm:norm[role+k]}; }
    if(!best) continue;
    const lab=STATS[best.k][0];
    const why=[`Hit ${best.line}+ in ${best.hits}/${best.games} games`,`averaging ${best.avg.toFixed(1)}`,`line is ${best.diff.toFixed(2)}× the typical starting ${role} (${best.norm.toFixed(1)})`];
    if(best.streak>=2) why.push(`${best.streak} straight`);
    const area=AREA(best.k); const weak=area.find(a=>t.oppWeak.includes(a)), str=area.find(a=>t.oppStr.includes(a));
    if(weak) why.push(`${t.oppName} ${weak} is listed as a weakness in the matchup report`); else if(str) why.push(`caution: ${t.oppName} ${str} is listed as a strength`);
    if(t.weather&&!t.weather.indoor&&t.weather.impact&&t.weather.impact!=='none') why.push(`${t.weather.impact} weather impact forecast${t.weather.wind_mph!=null?` (wind ${t.weather.wind_mph} mph)`:''}`);
    const injuryNote=withInjury(why,name,team);
    out.push({slug,name,team,role,stat:best.k,opp:t.opp,oppName:t.oppName,at:t.at,kick:t.kick,game:t.slug,prop:`Over ${best.line-0.5} ${lab}`,bench:`${best.line}+, set from his game logs`,
      hits:best.hits,games:best.games,streak:best.streak,avg:best.avg,thr:best.line,score:Math.round(best.score*10)/10,strip:best.strip.slice(-5),label:`${best.line}+ ${lab}`,why:why.join('; ')+'.',injuryNote}); }
  return out.sort((a,b)=>b.score-a.score); }
export function bestProps(limit=18){ const all=candidates(); const pick:any[]=[]; const cnt=(f:(r:any)=>boolean)=>pick.filter(f).length;
  const ok=(r:any)=> cnt(x=>x.team===r.team)<2 && cnt(x=>x.game===r.game)<3 && cnt(x=>x.role===r.role)<6;
  for(const r of all){ if(pick.length>=limit) break; if(ok(r)) pick.push(r); }
  for(const role of ['QB','RB','WR/TE']){ while(cnt(x=>x.role===role)<3){ const c=all.find(r=>r.role===role&&!pick.includes(r)&&cnt(x=>x.team===r.team)<2); if(!c) break;
      const counts:Record<string,number>={}; pick.forEach(x=>counts[x.role]=(counts[x.role]||0)+1);
      const over=[...pick].reverse().find(x=>x.role!==role&&(counts[x.role]||0)>3); if(!over) break; pick.splice(pick.indexOf(over),1,c); } }
  return pick.sort((a,b)=>b.score-a.score); }

// ---------- Sleepers: under-the-radar value ----------
const VOL:Record<string,string>={QB:'passYds',RB:'rushYds','WR/TE':'recYds'};
export const SLEEPER_RATE=0.75, STAR_RANK=15;
// Established stars whose CSV totals understate them (missing or misclassified games). Excluded from Sleepers by name.
// Keep this list short and documented; extend when a well-known player shows up as a "sleeper" only because of data gaps.
export const KNOWN_STARS=new Set(['George Kittle','Mike Evans','Stefon Diggs','Chris Godwin Jr.','Christian McCaffrey','Nico Collins','Malik Nabers','Brock Bowers','Davante Adams','Travis Kelce','Mark Andrews','Tyreek Hill','Cooper Kupp','DK Metcalf','Deebo Samuel','Keenan Allen','Amari Cooper','Alvin Kamara','Saquon Barkley','Josh Allen','Lamar Jackson','Jalen Hurts','Patrick Mahomes','Joe Burrow','Justin Jefferson',"Ja'Marr Chase",'CeeDee Lamb','A.J. Brown','Garrett Wilson','Puka Nacua','Amon-Ra St. Brown','Deebo Samuel Sr.','Terry McLaurin','Justin Herbert','Jayden Daniels','Khalil Shakir']);
const SLEEPER_OK=(role:string,k:string,line:number)=> /Yds$/.test(k) || (k==='rec'&&line>=4);
export const SLEEPER_NOTE=`"Not a big name" means outside the top ${STAR_RANK} at his position in both season total and per-game volume (passing yds for QBs, rushing yds for RBs, receiving yds for WR/TEs). A short, documented list of established stars whose totals in our data are understated by missing games is also excluded. For each remaining player we take the highest yardage line (or 4+ receptions) he cleared in at least ${SLEEPER_RATE*100}% of games (3+ games), or in 70% if that gives a line at least 10% higher and nearer his median, skipping lines under half of a solid starter's output. Score = 35 × hit rate + 25 × line difficulty + 20 × recent trend (last-3 average vs season, up to +100%) + 10 if the Week 6 opponent's matching defensive area is listed as a weakness (−5 if a strength) + 2 per game played (max 6). Players on bye or listed Out are excluded; at most 2 per team.`;
export function sleepers(limit=15){ const w=currentWeek(); const pg=(PG ||= buildPgames(players)).p as any[]; candidates();
  const T:Record<string,any>={}; for(const g of w.games){ const base={kick:fmtKick(g.kickoff),slug:g.slug,weather:g.cond?.weather,inj:g.cond?.injuries||[]};
    T[g.awayCode]={...base,oppName:g.home,at:'@',oppStr:g.home_strengths||[],oppWeak:g.home_weaknesses||[]}; T[g.homeCode]={...base,oppName:g.away,at:'vs',oppStr:g.away_strengths||[],oppWeak:g.away_weaknesses||[]}; }
  const rank:Record<string,number>={}; const star=new Set<string>();
  const rankBy=(role:string,k:string,perGame:boolean)=>pg.filter(p=>p[3]===role).map(p=>{const v=p[4].filter((g:any)=>k in g[2]).map((g:any)=>g[2][k]); const tot=v.reduce((a:number,b:number)=>a+b,0); return [p[0], perGame?(v.length>=2?tot/v.length:0):tot] as [string,number];}).sort((a,b)=>b[1]-a[1]);
  for(const [role,k] of Object.entries(VOL)){ rankBy(role,k,false).forEach(([s],i)=>{rank[s]=i+1; if(i<STAR_RANK) star.add(s);}); rankBy(role,k,true).slice(0,STAR_RANK).forEach(([s])=>star.add(s)); }
  const norm:Record<string,number>={}; for(const [role,ks] of Object.entries(PROPS)) for(const k of ks){ const avgs=pg.filter(p=>p[3]===role).map(p=>p[4].filter((g:any)=>k in g[2]).map((g:any)=>g[2][k])).filter((v:number[])=>v.length>=3).map((v:number[])=>v.reduce((a,b)=>a+b,0)/v.length); norm[role+k]=pct(avgs.filter((x:number)=>x>0),0.75)||1; }
  const out:any[]=[];
  for(const [slug,name,team,role,games] of pg){ const t=T[team]; if(!t||!VOL[role]||star.has(slug)||KNOWN_STARS.has(name)) continue;
    if(t.inj.some((i:any)=>(i.player||i.name)===name&&/^out|^ir|doubtful/i.test(i.status||''))) continue;
    let best:any=null;
    for(const k of PROPS[role]){ const gs=games.filter((g:any)=>k in g[2]); if(gs.length<3) continue; const vals=gs.map((g:any)=>g[2][k]);
      const line=pickLine(vals,k,SLEEPER_RATE); if(line<MIN_LINE(role,k)||!SLEEPER_OK(role,k,line)) continue;
      const diff=Math.min(line/norm[role+k],1.5); if(diff<0.5) continue;
      const strip=gs.map((g:any)=>({d:g[0],o:g[1],v:g[2][k],h:g[2][k]>=line})); const hits=strip.filter((x:any)=>x.h).length;
      const avg=vals.reduce((a:number,b:number)=>a+b,0)/vals.length; const l3=vals.slice(-3).reduce((a:number,b:number)=>a+b,0)/Math.min(3,vals.length); const trend=avg?Math.max(0,Math.min(l3/avg-1,1)):0;
      const area=AREA(k); const weak=area.find(a=>t.oppWeak.includes(a)), str=area.find(a=>t.oppStr.includes(a));
      const score=35*hits/gs.length+25*diff/1.5+20*trend+(weak?10:str?-5:0)+2*Math.min(gs.length,6);
      if(!best||score>best.score) best={k,line,strip,hits,games:gs.length,avg,l3,trend,weak,str,score,diff}; }
    if(!best) continue; const lab=STATS[best.k][0];
    const why=[`#${rank[slug]} ${role} in season ${STATS[VOL[role]][0].toLowerCase()}`,`hit ${best.line}+ in ${best.hits}/${best.games}`,`last 3 avg ${best.l3.toFixed(1)} vs ${best.avg.toFixed(1)} season`];
    if(best.weak) why.push(`${t.oppName} ${best.weak} is listed as a weakness`); else if(best.str) why.push(`caution: ${t.oppName} ${best.str} is listed as a strength`);
    const injuryNote=withInjury(why,name,team);
    out.push({slug,name,team,role,stat:best.k,oppName:t.oppName,at:t.at,kick:t.kick,game:t.slug,prop:`Over ${best.line-0.5} ${lab}`,bench:`${best.line}+, set from his game logs`,hits:best.hits,games:best.games,injuryNote,
      streak:(()=>{let n=0;for(let i=best.strip.length-1;i>=0&&best.strip[i].h;i--)n++;return n})(),avg:best.avg,thr:best.line,score:Math.round(best.score*10)/10,strip:best.strip.slice(-5),label:`${best.line}+ ${lab}`,why:why.join('; ')+'.',rank:rank[slug]}); }
  const pick:any[]=[]; for(const r of out.sort((a,b)=>b.score-a.score)){ if(pick.length>=limit) break; if(pick.filter(x=>x.team===r.team).length<2) pick.push(r); }
  return {pick,all:out}; }
