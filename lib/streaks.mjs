// Streak engine shared by the app and the content generator. Thresholds are standard benchmark lines, NOT sportsbook lines.
export const GROUPS = {
  passing:   { label:'Passing',   markets:[['passYds',200,'Pass Yds'],['passYds',250,'Pass Yds'],['passYds',300,'Pass Yds'],['passTd',1,'Pass TD'],['passTd',2,'Pass TD']], cats:['passing'] },
  rushing:   { label:'Rushing',   markets:[['primYds',25,'Rush Yds'],['primYds',50,'Rush Yds'],['primYds',75,'Rush Yds'],['primYds',100,'Rush Yds'],['primTd',1,'Rush TD'],['car',5,'Carries'],['car',10,'Carries']], cats:['rushing'] },
  receiving: { label:'Receiving', markets:[['primYds',50,'Rec Yds'],['primYds',75,'Rec Yds'],['primYds',100,'Rec Yds'],['rec',4,'Receptions'],['rec',6,'Receptions'],['primTd',1,'Rec TD']], cats:['receiving'] },
  defense:   { label:'Defense',   markets:[['tackles',5,'Tackles'],['tackles',8,'Tackles']], cats:['defense'] },
  kicking:   { label:'Kicking',   markets:[['fgm',2,'FG Made']], cats:['kicking'] },
};
// Receptions also apply to rushing-category game rows (rec count is recorded there too).
GROUPS.receiving.extraCats = { rec: ['rushing'] };
// QB rushing lives on passing rows (carries from the CSV; rush yds/TD from data/supplemental/qb-rushing.json).
GROUPS.rushing.extraCats = { car: ['passing'], primYds: ['passing'], primTd: ['passing'] };
export const mkey = (f,t)=> `${f}-${t}`;
export const mlabel = (lab,t)=> lab==='Rush TD'||lab==='Rec TD'? `${lab} (${t}+)` : `${t}+ ${lab}`;
export function marketGames(p, group, field){
  const g=GROUPS[group]; const cats=[...g.cats, ...((g.extraCats||{})[field]||[])];
  return p.games.filter(x=>cats.includes(x.cat) && typeof x[field]==='number');
}
/** Evaluate one player on one threshold. Games oldest -> newest. */
export function evalMarket(p, group, [field,thr,lab]){
  const gs=marketGames(p,group,field); if(!gs.length) return null;
  const hits=gs.map(x=>x[field]>=thr);
  const last=hits[hits.length-1]; let n=0; for(let i=hits.length-1;i>=0&&hits[i]===last;i--) n++;
  return { slug:p.slug, name:p.name, team:p.team, group, field, thr, key:mkey(field,thr), label:mlabel(lab,thr),
    hot:last, streak:n, hits:hits.filter(Boolean).length, games:gs.length,
    strip:gs.map(x=>({d:x.date,o:x.opp,v:x[field],h:x[field]>=thr})) };
}
export function playerStreaks(p){ const out=[]; for(const [g,def] of Object.entries(GROUPS)) for(const m of def.markets){ const r=evalMarket(p,g,m); if(r) out.push(r);} return out; }
/** Hot: active hit streak >= min. Cold: active miss streak >= min, only for players who have hit that line at some point this season (avoids listing every bench player). */
export function allStreaks(players, {min=3}={}){
  const hot=[], cold=[];
  for(const p of players) for(const r of playerStreaks(p)){
    if(r.hot && r.streak>=min) hot.push(r);
    else if(!r.hot && r.streak>=min && r.hits>0) cold.push(r);
  }
  const sort=(a,b)=> b.streak-a.streak || b.thr-a.thr || b.hits/b.games-a.hits/a.games;
  return { hot:hot.sort(sort), cold:cold.sort(sort) };
}

// Default "top streaks" list: one active streak per player, at the highest clean line every game of that
// streak actually cleared, ranked so a longer streak and a line that is high versus the player's average
// and versus a typical starter both score higher. Easy lines (1+ reception, and similar) fall down the list.
const ROLE_OF = { passing:'QB', rushing:'RB', receiving:'WR/TE', defense:'DEF', kicking:'K' };
// [field, categories, label, step, minimum line]. Anytime TD sums rush+rec (and QB rush) TDs on the same date.
const VALUE_STATS = {
  passYds: ['passYds',['passing'],'Pass Yds',5,150,false],
  passTd:  ['passTd',['passing'],'Pass TD',1,1,false],
  rushYds: ['primYds',['rushing','passing'],'Rush Yds',5,25,false],
  car:     ['car',['rushing','passing'],'Carries',1,5,false],
  recYds:  ['primYds',['receiving'],'Rec Yds',5,25,false],
  rec:     ['rec',['receiving','rushing'],'Receptions',1,3,false],
  rrTd:    ['primTd',['rushing','receiving','passing'],'Anytime TD',1,1,true],
  tackles: ['tackles',['defense'],'Tackles',1,5,false],
  fgm:     ['fgm',['kicking'],'FG Made',1,1,false],
};
const ROLE_KEYS = {
  QB: ['passYds','passTd','rushYds','car','rrTd'],
  RB: ['rushYds','recYds','rec','car','rrTd'],
  'WR/TE': ['recYds','rec','rrTd'],
  DEF: ['tackles'],
  K: ['fgm'],
};
function statSeries(p, field, cats, sumDupes){
  const out=[], seen=new Map();
  for(const g of p.games){ if(!cats.includes(g.cat)||typeof g[field]!=='number') continue;
    const i=seen.get(g.date);
    if(i==null){ seen.set(g.date,out.length); out.push({d:g.date,o:g.opp,v:g[field]}); }
    else out[i].v = sumDupes ? out[i].v+g[field] : Math.max(out[i].v, g[field]); }
  return out;
}
function floorLine(minVal, step, minLine){ const t=Math.floor(minVal/step+1e-9)*step; return t>=minLine ? t : null; }
/** Longer streaks score higher, but only when the line is meaningful vs a typical starter and vs this player's own average. */
function streakValue(streak, thr, avg, typical){
  const market=thr/Math.max(typical,0.01), self=thr/Math.max(avg,0.01);
  return Math.pow(streak,1.15) * Math.pow(Math.min(Math.max(market,0.05),2.4),1.2) * Math.pow(Math.min(Math.max(self,0.15),1.5),0.9);
}
/**
 * Top active streaks by value. For each player and stat, every suffix of the game log (the live streak at that length)
 * is priced at the highest step-line all of those games cleared; the best length wins. One row per player.
 * Computed from game logs — not a prop-builder search, so it does not use the free-search quota.
 */
export function topValueStreaks(players, {limit=10, min=3}={}){
  const series=new Map();
  for(const p of players){ const role=ROLE_OF[p.cat]; const keys=ROLE_KEYS[role]; if(!keys) continue;
    for(const key of keys){ const [field,cats,,,,sumDupes]=VALUE_STATS[key]; const gs=statSeries(p,field,cats,sumDupes); if(gs.length>=min) series.set(p.slug+'\0'+key, gs); } }
  // Market lines a normal starter is priced around. The role's own 75th-percentile average can raise these, never lower them,
  // so a thin stat (tackles, anytime TD) is not treated as wildly difficult just because most of the league is near zero.
  const MARKET={
    'QB:passYds':225,'QB:passTd':1.5,'QB:rushYds':25,'QB:car':6,'QB:rrTd':1,
    'RB:rushYds':60,'RB:recYds':20,'RB:rec':3,'RB:car':14,'RB:rrTd':1,
    'WR/TE:recYds':55,'WR/TE:rec':4.5,'WR/TE:rrTd':1,
    'DEF:tackles':7,'K:fgm':1.5,
  };
  const buckets={};
  for(const p of players){ const role=ROLE_OF[p.cat]; if(!role) continue;
    for(const key of ROLE_KEYS[role]||[]){ const gs=series.get(p.slug+'\0'+key); if(!gs||gs.length<3) continue;
      (buckets[role+':'+key] ||= []).push(gs.reduce((a,g)=>a+g.v,0)/gs.length); } }
  const typical={};
  for(const [rk,avgs] of Object.entries(buckets)){ avgs.sort((a,b)=>a-b); const p75=avgs[Math.min(avgs.length-1,Math.floor(0.75*avgs.length))]||1;
    typical[rk]=Math.max(MARKET[rk]||1, p75); }
  const bestByPlayer=new Map();
  for(const p of players){ const role=ROLE_OF[p.cat]; const keys=ROLE_KEYS[role]; if(!keys) continue;
    let best=null;
    for(const key of keys){ const gs=series.get(p.slug+'\0'+key); if(!gs) continue;
      const [,,lab,step,minLine]=VALUE_STATS[key]; const avg=gs.reduce((a,g)=>a+g.v,0)/gs.length; const typ=typical[role+':'+key]||MARKET[role+':'+key]||1;
      for(let n=gs.length;n>=min;n--){ const window=gs.slice(-n); const thr=floorLine(Math.min(...window.map(g=>g.v)),step,minLine); if(thr==null) continue;
        const score=streakValue(n,thr,avg,typ); if(best&&score<=best.score) continue;
        const hits=gs.filter(g=>g.v>=thr);
        best={ slug:p.slug, name:p.name, team:p.team, group:key, field:key, thr, key:key+'-'+thr, label:`${thr}+ ${lab}`,
          hot:true, streak:n, hits:hits.length, games:gs.length, avg, typical:typ, score,
          strip:gs.map(g=>({d:g.d,o:g.o,v:g.v,h:g.v>=thr})) }; } }
    if(best) bestByPlayer.set(p.slug,best); }
  const ranked=[...bestByPlayer.values()].sort((a,b)=>b.score-a.score||b.streak-a.streak||b.thr-a.thr);
  const out=[], per={};
  for(const r of ranked){ if(out.length>=limit) break; if((per[r.field]||0)>=3) continue; per[r.field]=(per[r.field]||0)+1; out.push(r); }
  if(out.length<limit) for(const r of ranked){ if(out.length>=limit) break; if(!out.includes(r)) out.push(r); }
  return out;
}

// Best hit-rate prop for the team tables. One candidate per stat: the highest non-trivial line
// still hit in at least 60% of games (3+ games). The winner is the highest hit rate, then the line
// that is highest versus a typical starter at that position. Easy lines sit below the minimums.
const PROP_SHORT = { passYds:'Pass Yds', passTd:'Pass TD', rushYds:'Rush Yds', car:'Car', recYds:'Rec Yds', rec:'Rec', rrTd:'TD', tackles:'Tackles', fgm:'FG' };
const PROP_MARKET = {
  'QB:passYds':225,'QB:passTd':1.5,'QB:rushYds':25,'QB:car':6,'QB:rrTd':1,
  'RB:rushYds':60,'RB:recYds':20,'RB:rec':3,'RB:car':14,'RB:rrTd':1,
  'WR/TE:recYds':55,'WR/TE:rec':4.5,'WR/TE:rrTd':1,
  'DEF:tackles':7,'K:fgm':1.5,
};
let _propTypical = null;
function propTypical(players){
  if(_propTypical) return _propTypical;
  const buckets = {};
  for(const p of players){ const role=ROLE_OF[p.cat]; if(!role) continue;
    for(const key of Object.keys(VALUE_STATS)){ const [field,cats,,,,sumDupes]=VALUE_STATS[key]; const gs=statSeries(p,field,cats,sumDupes); if(gs.length<3) continue;
      (buckets[role+':'+key] ||= []).push(gs.reduce((a,g)=>a+g.v,0)/gs.length); } }
  const typical = {};
  for(const [rk,avgs] of Object.entries(buckets)){ avgs.sort((a,b)=>a-b); const p75=avgs[Math.min(avgs.length-1,Math.floor(0.75*avgs.length))]||1;
    typical[rk]=Math.max(PROP_MARKET[rk]||1, p75); }
  return _propTypical = typical;
}
export function bestHitProp(p, players){
  const role=ROLE_OF[p.cat]; const typical=propTypical(players||[]);
  let best=null;
  for(const key of Object.keys(VALUE_STATS)){
    const [field,cats,lab,step,minLine,sumDupes]=VALUE_STATS[key];
    const gs=statSeries(p,field,cats,sumDupes); if(gs.length<3||!(minLine>0)) continue;
    const vals=gs.map(g=>g.v); const cap=Math.max(...vals); let pick=null;
    for(let thr=minLine; thr<=cap+1e-9; thr+=step){ const hits=vals.filter(v=>v+1e-9>=thr).length; if(hits/gs.length+1e-9<0.6) break; pick={thr,hits,games:gs.length}; }
    if(!pick) continue;
    const typ=(role&&typical[role+':'+key])||PROP_MARKET[role+':'+key]||minLine;
    const rate=pick.hits/pick.games; const lift=pick.thr/Math.max(typ,0.01);
    const short=PROP_SHORT[key]||lab;
    const row={...pick,rate,lift,key,text:`${pick.thr}+ ${short} · ${pick.hits}/${pick.games}`,title:`${pick.thr}+ ${lab} in ${pick.hits} of ${pick.games} games (${Math.round(rate*100)}%)`};
    if(!best||rate>best.rate+1e-9||(Math.abs(rate-best.rate)<1e-9&&lift>best.lift)) best=row;
  }
  return best;
}
