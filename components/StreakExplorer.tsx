'use client'; import { useMemo, useState } from 'react'; import Chips from './Chips'; import { StreakTableView } from './StreakView';
const GROUPS:[string,string][]=[['all','All'],['passing','QB / Passing'],['rushing','RB / Rushing'],['receiving','WR·TE / Receiving'],['defense','Defense'],['kicking','Kicking']];
export default function StreakExplorer({rows,initialMode='hot',groups,limit=50,showMode=true}:{rows:any[],initialMode?:'hot'|'cold',groups?:string[],limit?:number,showMode?:boolean}){
  const [g,setG]=useState('all'), [mode,setMode]=useState<'hot'|'cold'>(initialMode), [min,setMin]=useState(3), [sort,setSort]=useState<'streak'|'rate'|'line'>('streak');
  const opts=GROUPS.filter(([k])=>k==='all'||!groups||groups.includes(k));
  const list=useMemo(()=>rows.filter(r=>(g==='all'||r.group===g)&&r.hot===(mode==='hot')&&r.streak>=min).sort((a,b)=>sort==='rate'?b.hits/b.games-a.hits/a.games||b.streak-a.streak:sort==='line'?b.thr-a.thr||b.streak-a.streak:b.streak-a.streak||b.hits/b.games-a.hits/a.games),[rows,g,mode,min,sort]);
  return <div><div className="space-y-1 mb-3">{opts.length>2&&<Chips label="Position / stat category" options={opts} value={g} onChange={setG}/>}
    <div className="flex flex-wrap gap-x-4">{showMode&&<Chips label="Streak type" options={[['hot','🔥 Hot'],['cold','🧊 Cold']]} value={mode} onChange={setMode}/>}
    <Chips label="Minimum streak" options={[[2,'2+'],[3,'3+'],[4,'4+'],[5,'5 straight']]} value={min} onChange={setMin}/>
    <Chips label="Sort by" options={[['streak','Longest'],['rate','Hit rate'],['line','Highest line']]} value={sort} onChange={setSort}/></div></div>
   <p className="text-xs text-slate-500 mb-2" aria-live="polite">{list.length} streaks</p>
   {list.length?<StreakTableView rows={list.slice(0,limit)}/>:<p className="card text-sm text-slate-400">No streaks match these filters.</p>}</div>; }
