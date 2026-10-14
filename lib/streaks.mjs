// Streak engine shared by the app and the content generator. Thresholds are standard benchmark lines, NOT sportsbook lines.
export const GROUPS = {
  passing:   { label:'Passing',   markets:[['passYds',200,'Pass Yds'],['passYds',250,'Pass Yds'],['passYds',300,'Pass Yds'],['passTd',1,'Pass TD'],['passTd',2,'Pass TD']], cats:['passing'] },
  rushing:   { label:'Rushing',   markets:[['primYds',50,'Rush Yds'],['primYds',75,'Rush Yds'],['primYds',100,'Rush Yds'],['primTd',1,'Rush TD']], cats:['rushing'] },
  receiving: { label:'Receiving', markets:[['primYds',50,'Rec Yds'],['primYds',75,'Rec Yds'],['primYds',100,'Rec Yds'],['rec',4,'Receptions'],['rec',6,'Receptions'],['primTd',1,'Rec TD']], cats:['receiving'] },
  defense:   { label:'Defense',   markets:[['tackles',5,'Tackles'],['tackles',8,'Tackles']], cats:['defense'] },
  kicking:   { label:'Kicking',   markets:[['fgm',2,'FG Made']], cats:['kicking'] },
};
// Receptions also apply to rushing-category game rows (rec count is recorded there too).
GROUPS.receiving.extraCats = { rec: ['rushing'] };
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
