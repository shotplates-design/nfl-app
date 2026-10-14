'use client'; import { useEffect, useState } from 'react';
let cache:any=null; let pending:Promise<any>|null=null;
export function usePindex(){ const [d,setD]=useState<any>(cache);
  useEffect(()=>{ if(cache) return; pending ||= fetch('/pindex.json').then(r=>r.json()).then(j=>cache=j); pending.then(setD); },[]); return d as Record<string,any>|null; }
export const LBL:Record<string,string>={passYds:'Pass Yds',passTd:'Pass TD',int:'INT',cmp:'Cmp',att:'Att',rtg:'Rating',primYds:'Yds',car:'Carries',primTd:'TD',rec:'Rec',tgts:'Targets',lng:'Long',tackles:'Tackles',solo:'Solo',sacks:'Sacks',pd:'PD',ff:'FF',fgm:'FGM',fga:'FGA',pts:'Pts',fgLng:'Long',punts:'Punts',puntYds:'Punt Yds',puntAvg:'Avg',in20:'In 20',net:'Net'};
