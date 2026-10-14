// Auto-generates SEO content pages from data/players.json (no invented numbers: every figure is computed from the CSV).
// Run: npm run content  (scheduled via GitHub Actions / cron, then redeploy). Re-run scripts/prepare_data.py first when the CSV changes.
import fs from 'fs';
const P = JSON.parse(fs.readFileSync(new URL('../data/players.json', import.meta.url)));
const KEY = {passing:['passYds','passing yards'],rushing:['primYds','rushing yards'],receiving:['primYds','receiving yards'],defense:['tackles','tackles'],kicking:['pts','points'],punting:['puntAvg','yards per punt']};
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const r1 = n => Math.round(n*10)/10;
const today = new Date(); const iso = today.toISOString().slice(0,10);
// ISO week label
const wk = (()=>{const d=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return `${d.getUTCFullYear()}-w${Math.ceil(((d-y)/864e5+1)/7)}`})();
const articles = [];
const pg = p => p.games.filter(g=>g.cat===p.cat);
// latest game key in data = "this week"
const latestK = Math.max(...P.flatMap(p=>p.games.map(g=>g.k)));
import { allStreaks, GROUPS } from '../lib/streaks.mjs';
const ST = allStreaks(P);
const stripTxt = r => r.strip.map(g=>g.h?'✓':'✗').join('');
for (const [g,def] of Object.entries(GROUPS)) {
  const hot=ST.hot.filter(r=>r.group===g).slice(0,15), cold=ST.cold.filter(r=>r.group===g).slice(0,8);
  if(!hot.length&&!cold.length) continue;
  articles.push({slug:`${g}-prop-streaks-${wk}`,kind:'streaks',date:iso,cat:g,
    title:`NFL ${def.label} Streaks This Week: Who Keeps Hitting? (${iso})`,
    description:`Active NFL ${def.label.toLowerCase()} streaks${hot[0]?`: ${hot.slice(0,3).map(r=>`${r.name} ${r.streak} straight ${r.label}`).join(', ')}`:''}. Hit rates and game-by-game results.`,
    intro:`Players with active streaks of 3+ consecutive games hitting (or missing) standard ${def.label.toLowerCase()} benchmarks. Thresholds are standard statistical benchmarks, not sportsbook lines.`,
    hot:hot.map(r=>({...r,stripTxt:stripTxt(r)})), cold:cold.map(r=>({...r,stripTxt:stripTxt(r)}))});
}
for (const [cat,[f,label]] of Object.entries(KEY)) {
  // week top performers
  const wkRows = P.filter(p=>p.cat===cat).flatMap(p=>pg(p).filter(g=>g.k===latestK&&typeof g[f]==='number').map(g=>({name:p.name,slug:p.slug,team:p.team,val:g[f],opp:g.opp,result:g.result,date:g.date})));
  if(wkRows.length) articles.push({slug:`top-${cat}-performances-${wkRows[0].date.replace(/\W+/g,'-').toLowerCase()}`,kind:'performers',date:iso,cat,
    title:`Best NFL ${cat[0].toUpperCase()+cat.slice(1)} Performances – ${wkRows[0].date}`,
    description:`Top ${label} totals from NFL games on ${wkRows[0].date}: ${wkRows.sort((a,b)=>b.val-a.val).slice(0,3).map(x=>`${x.name} (${x.val})`).join(', ')}.`,
    intro:`Leaders in ${label} from the most recent game date in our data (${wkRows[0].date}).`, statLabel:label, rows:wkRows.slice(0,15)});
}
// Matchup history pages: team vs opponent from games already played (no schedule data -> no predictions)
const teams=[...new Set(P.map(p=>p.team))];
for (const t of teams) {
  const tp=P.filter(p=>p.team===t); const opps={};
  for(const p of tp) for(const g of p.games){(opps[g.opp.replace(/^(@|vs)/,'')] ??= {res:g.result,date:g.date,home:g.opp.startsWith('vs'),top:[]}).top.push({name:p.name,slug:p.slug,cat:g.cat,val:g[KEY[g.cat][0]],label:KEY[g.cat][1]});}
  for(const [o,m] of Object.entries(opps)){
    const top=m.top.filter(x=>typeof x.val==='number'&&['passing','rushing','receiving'].includes(x.cat)).sort((a,b)=>b.val-a.val).slice(0,6);
    articles.push({slug:`${t}-vs-${o.toLowerCase()}-matchup-${m.date.split(' ')[1].replace('/','-')}`,kind:'matchup',date:iso,team:t,opp:o,
      title:`${t.toUpperCase()} vs ${o} Matchup Breakdown & Player Stats (${m.date})`,
      description:`${t.toUpperCase()} ${m.home?'hosted':'visited'} ${o} on ${m.date} (${m.res}). Key player stat lines for bettors reviewing this matchup.`,
      intro:`Result: ${m.res} (${m.home?'home':'away'}, ${m.date}). Top offensive stat lines for ${t.toUpperCase()} in this game:`, rows:top});
  }
}
fs.writeFileSync(new URL('../data/articles.json', import.meta.url), JSON.stringify(articles));
fs.writeFileSync(new URL('../public/search.json', import.meta.url), JSON.stringify(P.map(p=>[p.name,p.slug,p.team,p.cat||''])));
console.log(`generated ${articles.length} articles`);
// Compact player index for client features (watchlist, compare). Every number computed from players.json.
import { playerStreaks } from '../lib/streaks.mjs';
const CS={passing:['passYds','passTd','int','cmp','att','rtg'],rushing:['primYds','car','primTd','rec','tgts','lng'],receiving:['primYds','rec','tgts','primTd','lng','car'],defense:['tackles','solo','sacks','int','pd','ff'],kicking:['fgm','fga','pts','fgLng'],punting:['punts','puntYds','puntAvg','in20','net']};
const idx={};
for(const p of P){ const gs=p.games.filter(g=>g.cat===p.cat); if(!gs.length||!p.cat) continue;
  const av={}; for(const f of CS[p.cat]||[]){ const v=gs.map(g=>g[f]).filter(x=>typeof x==='number'); if(v.length) av[f]=Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10; }
  idx[p.slug]={n:p.name,t:p.team,c:p.cat,gp:gs.length,av,st:playerStreaks(p).map(r=>[r.label,r.streak,r.hot?1:0,r.hits,r.games])}; }
fs.writeFileSync(new URL('../public/pindex.json', import.meta.url), JSON.stringify(idx));
const { buildPgames } = await import('../lib/props.mjs');
fs.writeFileSync(new URL('../public/pgames.json', import.meta.url), JSON.stringify(buildPgames(P)));
console.log('pindex', Object.keys(idx).length);
