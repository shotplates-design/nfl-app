'use client';
// Draws a branded results card on a canvas (logo = 'theplayerprops' lettering only) and shares it via the Web Share API,
// falling back to a PNG download.
export async function shareResultsImage(title:string, rows:any[]){
  const W=1080, H=1350, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); if(!x) return;
  x.fillStyle='#020617'; x.fillRect(0,0,W,H); x.fillStyle='#0f172a'; x.fillRect(40,190,W-80,H-330);
  x.textBaseline='alphabetic'; let px=60; const logo:[string,string,string][]=[['the','300','#e2e8f0'],['player','700','#ffffff'],['props','700','#34d399']];
  for(const [t,w,col] of logo){ x.font=`${w} 72px system-ui, -apple-system, Segoe UI, sans-serif`; x.fillStyle=col; x.fillText(t,px,120); px+=x.measureText(t).width; }
  x.fillStyle='#cbd5e1'; x.font='600 34px system-ui, sans-serif'; wrap(x,title.charAt(0).toUpperCase()+title.slice(1),70,250,W-140,42);
  let y=380; x.font='600 30px system-ui, sans-serif'; x.fillStyle='#64748b'; x.fillText('PLAYER',70,y-40); x.fillText('HITS',650,y-40); x.fillText('AVG',800,y-40); x.fillText('STREAK',900,y-40);
  for(const r of rows){ x.fillStyle='#ffffff'; x.font='700 38px system-ui, sans-serif'; x.fillText(clip(x,r.name,560),70,y+20);
    x.fillStyle='#94a3b8'; x.font='400 26px system-ui, sans-serif'; x.fillText(`${String(r.team||'').toUpperCase()} · ${r.role||''}`,70,y+56);
    x.fillStyle='#34d399'; x.font='700 38px system-ui, sans-serif'; x.fillText(`${r.hits}/${r.games}`,650,y+20);
    x.fillStyle='#e2e8f0'; x.fillText(Number(r.avg).toFixed(1),800,y+20); x.fillText(`🔥${r.streak}`,900,y+20);
    y+=100; x.fillStyle='#1e293b'; x.fillRect(70,y-28,W-140,2); }
  x.fillStyle='#34d399'; x.font='800 54px system-ui, sans-serif'; x.textAlign='center'; x.fillText('theplayerprops.com',W/2,H-80);
  x.fillStyle='#64748b'; x.font='400 24px system-ui, sans-serif'; x.fillText('Stats are informational only. 21+. Bet responsibly.',W/2,H-35);
  const blob:Blob|null=await new Promise(r=>c.toBlob(r,'image/png')); if(!blob) return;
  const file=new File([blob],'theplayerprops-search.png',{type:'image/png'}); const n:any=navigator;
  if(n.canShare&&n.canShare({files:[file]})){ try{ await n.share({files:[file],title:'ThePlayerProps',text:`${title} 👉 theplayerprops.com`}); return; }catch(e:any){ if(e?.name==='AbortError') return; } }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
function clip(x:CanvasRenderingContext2D,t:string,max:number){ if(x.measureText(t).width<=max) return t; while(t.length>1&&x.measureText(t+'…').width>max) t=t.slice(0,-1); return t+'…'; }
function wrap(x:CanvasRenderingContext2D,t:string,X:number,Y:number,max:number,lh:number){ let line=''; for(const w of t.split(' ')){ const n=line?line+' '+w:w; if(x.measureText(n).width>max&&line){ x.fillText(line,X,Y); Y+=lh; line=w; } else line=n; } x.fillText(line,X,Y); }
