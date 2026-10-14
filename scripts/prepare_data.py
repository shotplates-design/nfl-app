"""Convert raw CSV -> data/players.json, data/teams.json. Only uses values present in the CSV."""
import pandas as pd, json, re, math, os
D=os.path.dirname(os.path.abspath(__file__))+'/../data'
d=pd.read_csv(D+'/raw.csv',dtype=str)
def num(v):
    try:
        f=float(v); return None if math.isnan(f) else f
    except: return None
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
MON={'9':9,'10':10,'11':11,'12':12,'1':1,'2':2}
def sortkey(date):
    m,dd=date.split()[1].split('/'); m=int(m); return (m+12 if m<8 else m)*100+int(dd)
players={}
for _,r in d.iterrows():
    pid=r.player_id
    p=players.setdefault(pid,{'id':pid,'name':r.player_name,'team':r.current_team,'season':int(float(r.season)),'splits':[],'games':[]})
    if isinstance(r.date,str):
        g={'date':r.date,'opp':r.opp,'result':r.result,'k':sortkey(r.date)}
        if num(r.cmp) is not None:
            g['cat']='passing'
            for c,k in [('cmp','cmp'),('att','att'),('yds','passYds'),('td','passTd'),('int','int'),('rtg','rtg'),('qbr','qbr'),('sack','sacks'),('lng','lng')]: g[k]=num(r[c])
            # QB rows carry a 'car' value (carries). The CSV has no QB rush yds/TD: yds/td on these rows are passing.
            g['car']=num(r.car)
        elif num(r.car) is not None:
            y,a,car,rec=num(r.yds),num(r.avg),num(r.car) or 0,num(r.rec) or 0
            # shared yds/avg/td columns: decide rushing vs receiving by which divisor reproduces avg
            isrush = car>0 and a is not None and y is not None and abs(y/car-a)<0.06
            if rec>0 and a is not None and y is not None and abs(y/rec-a)<0.06 and not (isrush and car>=rec): isrush=False
            if y==0 and car==0: isrush=False
            g['cat']='rushing' if isrush else 'receiving'
            g['primYds']=y; g['primTd']=num(r.td); g['car']=car; g['rec']=rec; g['tgts']=num(r.tgts); g['lng']=num(r.lng); g['fum']=num(r.fum)
        elif num(r.tot) is not None:
            g['cat']='defense'
            for c,k in [('tot','tackles'),('solo','solo'),('sack','sacks'),('int','int'),('pd','pd'),('stf','tfl'),('ff','ff'),('fr','fr')]: g[k]=num(r[c])
        elif isinstance(r.fg,str) and '-' in r.fg:
            g['cat']='kicking'; m,a=r.fg.split('-'); g['fgm']=num(m); g['fga']=num(a); g['pts']=num(r.pts); g['fgLng']=num(r.lng)
            g['xp']=r.xp
        elif num(r.punts) is not None:
            g['cat']='punting'; g['punts']=num(r.punts); g['puntYds']=num(r.yds); g['puntAvg']=num(r.avg); g['in20']=num(r.in20); g['net']=num(r.net)
        else: continue
        p['games'].append(g)
    elif isinstance(r.team,str):
        p['splits'].append({'team':r.team,'w':num(r.w),'l':num(r.l),'t':num(r.t),'pf':num(r.pf),'pa':num(r.pa)})
out=[]; seen={}
for p in players.values():
    p['games'].sort(key=lambda g:g['k'])
    if not p['games'] and not p['splits']: continue
    s=slug(p['name']); 
    if s in seen: s=f"{s}-{p['team']}"
    if s in seen: s=f"{s}-{p['id']}"
    seen[s]=1; p['slug']=s
    cats=[g['cat'] for g in p['games']]
    p['cat']=max(set(cats),key=cats.count) if cats else None
    out.append(p)
json.dump(out,open(D+'/players.json','w'),separators=(',',':'))
print(len(out),'players',sum(len(p['games']) for p in out),'games')
