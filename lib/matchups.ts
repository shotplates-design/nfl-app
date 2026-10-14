import fs from 'fs'; import path from 'path'; import { players, streaksFor, teamName } from './data';
// Drop a new file at data/matchups/week-N.json (same shape as week-6.json); the highest week number is shown as "this week".
export const NICK: Record<string,string> = {Cardinals:'ari',Falcons:'atl',Ravens:'bal',Bills:'buf',Panthers:'car',Bears:'chi',Bengals:'cin',Browns:'cle',Cowboys:'dal',Broncos:'den',Lions:'det',Packers:'gb',Texans:'hou',Colts:'ind',Jaguars:'jax',Chiefs:'kc',Chargers:'lac',Rams:'lar',Raiders:'lv',Dolphins:'mia',Vikings:'min',Patriots:'ne',Saints:'no',Giants:'nyg',Jets:'nyj',Eagles:'phi',Steelers:'pit',Seahawks:'sea','49ers':'sf',Buccaneers:'tb',Titans:'ten',Commanders:'wsh'};
export type Game = { away:string; home:string; kickoff:string|null; network?:string; venue?:string|null; analysis?:any; away_strengths?:string[]; away_weaknesses?:string[]; home_strengths?:string[]; home_weaknesses?:string[]; slug:string; cond?:any; condUpdated?:string; awayCode:string; homeCode:string };
export type Week = { season:number; week:number; schedule_source:string; schedule_checked?:string; byes?:string[]; notes?:string; games:Game[] };
const dir = path.join(process.cwd(),'data','matchups');
export function weeks(): Week[] { return fs.readdirSync(dir).filter(f=>/^week-\d+\.json$/.test(f)).map(f=>{ const w=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
  w.games=w.games.map((g:any)=>({...g,awayCode:NICK[g.away]||g.away.toLowerCase(),homeCode:NICK[g.home]||g.home.toLowerCase(),slug:`${g.away}-at-${g.home}-${w.season}-week-${w.week}`.toLowerCase().replace(/[^a-z0-9]+/g,'-')})); attachConditions(w); return w; }).sort((a,b)=>b.week-a.week); }
export const currentWeek = ()=> weeks()[0];
export function findGame(slug:string){ for(const w of weeks()) { const g=w.games.find(g=>g.slug===slug); if(g) return {w,g}; } return null; }
export const fmtKick = (k:string|null)=> k? new Date(k).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET' : 'Time TBD';
/** Key players for a team: each player's best active hot streak (2+), longest first; plus notable cold streaks. All from season data. */
export function teamStreaks(code:string){ const hot:any[]=[], cold:any[]=[];
  for(const p of players.filter(p=>p.team===code)){ const st=streaksFor(p);
    const h=st.filter(r=>r.hot&&r.streak>=2).sort((a,b)=>b.streak-a.streak||b.thr-a.thr)[0]; if(h) hot.push(h);
    const c=st.filter(r=>!r.hot&&r.streak>=3&&r.hits>0).sort((a,b)=>b.streak-a.streak)[0]; if(c) cold.push(c); }
  const s=(a:any,b:any)=>b.streak-a.streak||b.hits/b.games-a.hits/a.games;
  return { hot:hot.sort(s).slice(0,8), cold:cold.sort(s).slice(0,4) }; }
export { teamName };

// Conditions feeds: data/feeds/week-N-conditions.json (see data/feeds/README.md). Matched by team codes.
const FEED_ALIAS: Record<string,string> = {was:'wsh',az:'ari',la:'lar'};
const fc=(c:string)=>{ const x=String(c).toLowerCase(); return FEED_ALIAS[x]||x; };
function attachConditions(w:any){ const f=path.join(process.cwd(),'data','feeds',`week-${w.week}-conditions.json`); if(!fs.existsSync(f)) return;
  const d=JSON.parse(fs.readFileSync(f,'utf8'));
  for(const g of w.games){ const c=(d.games||[]).find((x:any)=>fc(x.away)===g.awayCode&&fc(x.home)===g.homeCode); if(c){ g.cond={weather:c.weather||null,injuries:c.injuries||[]}; g.condUpdated=d.updated; } } }
