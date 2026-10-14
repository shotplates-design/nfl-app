// Prop search builder definitions. Values come straight from game logs; lines are user-chosen, not sportsbook lines.
// Role is inferred from a player's main stat category (the CSV has no position column), so WR and TE are grouped.
export const ROLE = { passing:'QB', rushing:'RB', receiving:'WR/TE', defense:'DEF', kicking:'K', punting:'P' };
export const ROLES = [['any','Any'],['QB','QB'],['RB','RB'],['WR/TE','WR/TE'],['DEF','Defense'],['K','K']];
// key: [label, field, categories the value is read from, default line]
export const STATS = {
  recYds:  ['Receiving yds','primYds',['receiving'],40],
  rushYds: ['Rushing yds','primYds',['rushing'],50],
  rec:     ['Receptions','rec',['receiving','rushing'],4],
  tgts:    ['Targets','tgts',['receiving','rushing'],5],
  car:     ['Carries (incl. QBs)','car',['rushing','passing'],10],
  rrTd:    ['Rush+Rec TD','primTd',['rushing','receiving'],1],
  passYds: ['Passing yds','passYds',['passing'],225],
  passTd:  ['Pass TD','passTd',['passing'],2],
  cmp:     ['Completions','cmp',['passing'],20],
  passAtt: ['Pass attempts','att',['passing'],30],
  int:     ['Interceptions thrown','int',['passing'],1],
  tackles: ['Tackles','tackles',['defense'],5],
  sacks:   ['Sacks','sacks',['defense'],1],
  fgm:     ['FG made','fgm',['kicking'],2],
};
/** Compact per-game index for the client: {p:[[slug,name,team,role,[[date,opp,{stat:value}]...]]]} */
export function buildPgames(players){
  return { p: players.filter(p=>p.games.length).map(p=>[p.slug,p.name,p.team,ROLE[p.cat]||'',p.games.map(g=>{ const v={};
    for(const [k,[,f,cats]] of Object.entries(STATS)) if(cats.includes(g.cat)&&typeof g[f]==='number') v[k]=g[f];
    return [g.date,g.opp,v]; }).filter(x=>Object.keys(x[2]).length)]).filter(x=>x[4].length) };
}
/** q: {stat, pos, dir:'over'|'under', line, scope:'season'|'last'|'streak'|'rate', n, sort}. Over means value >= line (e.g. 20 yds counts as over 20). Under means value < line. */
export function runQuery(pg, q){
  const out=[]; const n=Math.max(1,+q.n||1);
  for(const [slug,name,team,role,games] of pg.p){
    if(q.pos&&q.pos!=='any'&&role!==q.pos) continue;
    const gs=games.filter(g=>q.stat in g[2]); if(!gs.length) continue;
    const strip=gs.map(g=>{const v=g[2][q.stat]; return {d:g[0],o:g[1],v,h:q.dir==='under'?v<q.line:v>=q.line};});
    const hits=strip.filter(s=>s.h).length; let streak=0; for(let i=strip.length-1;i>=0&&strip[i].h;i--) streak++;
    let ok;
    if(q.scope==='season') ok = strip.length>=n && hits===strip.length;
    else if(q.scope==='last') ok = strip.length>=n && strip.slice(-n).every(s=>s.h);
    else if(q.scope==='streak') ok = streak>=n;
    else ok = strip.length>=1 && hits/strip.length*100>=n;
    if(!ok) continue;
    const avg=strip.reduce((a,s)=>a+s.v,0)/strip.length;
    out.push({slug,name,team,role,hits,games:strip.length,streak,avg,strip});
  }
  const s=q.sort||'streak';
  out.sort((a,b)=> s==='avg'?(q.dir==='under'?a.avg-b.avg:b.avg-a.avg) : s==='rate'? b.hits/b.games-a.hits/a.games||b.games-a.games : s==='name'? a.name.localeCompare(b.name) : b.streak-a.streak||b.hits-a.hits);
  return out;
}
export const DEFAULT_Q = { stat:'recYds', pos:'any', dir:'over', line:40, scope:'streak', n:3, sort:'streak' };
// Prebuilt, indexable queries.
export const POPULAR = [
  { slug:'wr-te-20-receiving-yards-every-game', title:'WRs/TEs with 20+ receiving yards in every game', q:{stat:'recYds',pos:'WR/TE',dir:'over',line:20,scope:'season',n:3,sort:'avg'} },
  { slug:'50-receiving-yards-last-3-games', title:'50+ receiving yards in each of the last 3 games', q:{stat:'recYds',pos:'any',dir:'over',line:50,scope:'last',n:3,sort:'avg'} },
  { slug:'rb-60-rushing-yards-streak', title:'RBs on a 3+ game streak of 60+ rushing yards', q:{stat:'rushYds',pos:'RB',dir:'over',line:60,scope:'streak',n:3,sort:'streak'} },
  { slug:'qb-250-passing-yards-every-game', title:'QBs with 250+ passing yards in every game', q:{stat:'passYds',pos:'QB',dir:'over',line:250,scope:'season',n:3,sort:'avg'} },
  { slug:'qb-5-carries-every-game', title:'QBs with 5+ carries in every game', q:{stat:'car',pos:'QB',dir:'over',line:5,scope:'season',n:3,sort:'avg'} },
  { slug:'anytime-td-streak', title:'Players with a rush/rec TD in 3+ straight games', q:{stat:'rrTd',pos:'any',dir:'over',line:1,scope:'streak',n:3,sort:'streak'} },
  { slug:'5-receptions-every-game', title:'5+ receptions in every game this season', q:{stat:'rec',pos:'any',dir:'over',line:5,scope:'season',n:3,sort:'avg'} },
  { slug:'defenders-7-tackles-streak', title:'Defenders with 7+ tackles in 3+ straight games', q:{stat:'tackles',pos:'DEF',dir:'over',line:7,scope:'streak',n:3,sort:'streak'} },
];
