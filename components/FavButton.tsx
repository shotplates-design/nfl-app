'use client'; import { useEffect, useState } from 'react'; import { readFavs, writeFavs, mergeRemote } from './favs';
export default function FavButton({slug,name,compact=false}:{slug:string,name:string,compact?:boolean}){ const [on,setOn]=useState(false);
  useEffect(()=>{ const u=()=>setOn(!!readFavs()[slug]); u(); mergeRemote(); window.addEventListener('bs:favs',u); return ()=>window.removeEventListener('bs:favs',u); },[slug]);
  return <button type="button" aria-pressed={on} aria-label={`${on?'Remove':'Add'} ${name} ${on?'from':'to'} watchlist`} onClick={()=>{const f=readFavs(); if(f[slug]) delete f[slug]; else f[slug]=name; writeFavs(f);}}
   className={`${compact?'inline-flex items-center justify-center w-6 h-8 text-base':'text-lg'} leading-none transition-transform active:scale-125 ${on?'text-amber-400':'text-slate-600 hover:text-slate-300'}`}>{on?'★':'☆'}</button>; }
