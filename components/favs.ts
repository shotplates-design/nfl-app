'use client';
// Watchlist: localStorage always; synced to the user's account (Upstash) when signed in.
const K='bs:favs'; type Favs=Record<string,string>; // slug -> name
export const readFavs=():Favs=>{ try{return JSON.parse(localStorage.getItem(K)||'{}')}catch{return {}} };
const emit=()=>window.dispatchEvent(new Event('bs:favs'));
export function writeFavs(f:Favs, sync=true){ localStorage.setItem(K,JSON.stringify(f)); emit(); if(sync) fetch('/api/favorites',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(f)}).catch(()=>{}); }
let merged=false;
export async function mergeRemote(){ if(merged) return; merged=true; try{ const r=await fetch('/api/favorites'); if(!r.ok) return; const remote=await r.json(); const m={...remote,...readFavs()}; writeFavs(m, JSON.stringify(m)!==JSON.stringify(remote)); }catch{} }
