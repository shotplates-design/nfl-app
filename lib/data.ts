import raw from '@/data/players.json';
export type Game = any; export type Player = { id:string; name:string; team:string; season:number; slug:string; cat:string|null; games:Game[]; splits:any[] };
export const players = raw as Player[];
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')).replace(/\/$/,'');
export const SITE_NAME = 'BetStats NFL';
export const TEAMS: Record<string,string> = {ari:'Arizona Cardinals',atl:'Atlanta Falcons',bal:'Baltimore Ravens',buf:'Buffalo Bills',car:'Carolina Panthers',chi:'Chicago Bears',cin:'Cincinnati Bengals',cle:'Cleveland Browns',dal:'Dallas Cowboys',den:'Denver Broncos',det:'Detroit Lions',gb:'Green Bay Packers',hou:'Houston Texans',ind:'Indianapolis Colts',jax:'Jacksonville Jaguars',kc:'Kansas City Chiefs',lac:'Los Angeles Chargers',lar:'Los Angeles Rams',lv:'Las Vegas Raiders',mia:'Miami Dolphins',min:'Minnesota Vikings',ne:'New England Patriots',no:'New Orleans Saints',nyg:'New York Giants',nyj:'New York Jets',phi:'Philadelphia Eagles',pit:'Pittsburgh Steelers',sea:'Seattle Seahawks',sf:'San Francisco 49ers',tb:'Tampa Bay Buccaneers',ten:'Tennessee Titans',wsh:'Washington Commanders'};
export const teamName = (t:string)=> TEAMS[t] || t.toUpperCase();
// key stats per category: [field, label]
export const CAT_STATS: Record<string,[string,string][]> = {
  passing:[['passYds','Pass Yds'],['passTd','Pass TD'],['int','INT'],['cmp','Cmp'],['att','Att'],['rtg','Rating'],['car','Car'],['primYds','Rush Yds'],['primTd','Rush TD']],
  rushing:[['primYds','Rush Yds'],['car','Carries'],['primTd','TD'],['rec','Rec'],['tgts','Targets'],['lng','Long']],
  receiving:[['primYds','Rec Yds'],['rec','Rec'],['tgts','Targets'],['primTd','TD'],['lng','Long'],['car','Carries']],
  defense:[['tackles','Tackles'],['solo','Solo'],['sacks','Sacks'],['int','INT'],['pd','PD'],['ff','FF']],
  kicking:[['fgm','FGM'],['fga','FGA'],['pts','Pts'],['fgLng','Long']],
  punting:[['punts','Punts'],['puntYds','Punt Yds'],['puntAvg','Avg'],['in20','In 20'],['net','Net Avg']],
};
export const CAT_LABEL: Record<string,string> = {passing:'Passing',rushing:'Rushing',receiving:'Receiving',defense:'Defense',kicking:'Kicking',punting:'Punting'};
export const keyStat = (cat:string)=> CAT_STATS[cat]?.[0];
export function catGames(p:Player){ return p.games.filter(g=>g.cat===p.cat); }
export function avg(gs:Game[],f:string){ const v=gs.map(g=>g[f]).filter(x=>typeof x==='number'); return v.length? v.reduce((a,b)=>a+b,0)/v.length : null; }
export function sum(gs:Game[],f:string){ return gs.map(g=>g[f]).filter(x=>typeof x==='number').reduce((a,b)=>a+b,0); }
export const fmt=(n:number|null|undefined,d=1)=> n==null? '—' : (Number.isInteger(n)? String(n) : n.toFixed(d));
// Rushing leaderboards (yds, carries, TD) include QBs: their rushing is stored on passing rows.
export function leaders(cat:string,field:string,n=50,minGames=2){ const qbCar=cat==='rushing'&&['car','primYds','primTd'].includes(field); return players.filter(p=>p.cat===cat||(qbCar&&p.cat==='passing')).map(p=>{const gs=qbCar?p.games.filter(g=>(g.cat==='rushing'||g.cat==='passing')&&typeof g[field]==='number'):catGames(p);return {p,gp:gs.length,total:sum(gs,field),avg:avg(gs,field)}})
  .filter(x=>x.gp>=minGames&&x.avg!=null).sort((a,b)=>b.total-a.total).slice(0,n); }
export const teamCodes = ()=> Array.from(new Set(players.map(p=>p.team))).sort();
export const bySlug = (s:string)=> players.find(p=>p.slug===s);
import { playerStreaks, allStreaks as _all, GROUPS } from './streaks.mjs';
export { GROUPS };
export const streaksFor = (p:Player)=> playerStreaks(p) as any[];
let _cache:any=null; export const allStreaks = ()=> (_cache ||= _all(players)) as {hot:any[],cold:any[]};
export const bestHot = (p:Player)=> streaksFor(p).filter(r=>r.hot&&r.streak>=2).sort((a,b)=>b.streak-a.streak||b.thr-a.thr)[0];
