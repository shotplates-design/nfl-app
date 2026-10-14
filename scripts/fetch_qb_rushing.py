"""Fetch per-game QB rushing (carries, rush yds, rush TD) from ESPN's public gamelog JSON for every player
with passing rows in data/raw.csv. Throttled (1.5s between requests). Each game is matched to the CSV by
ET date + opponent; it is kept only if ESPN carries == CSV carries, otherwise it is listed under "mismatches".
Output: data/supplemental/qb-rushing.json (merged by scripts/prepare_data.py)."""
import pandas as pd, json, time, os, urllib.request, datetime as dt
from zoneinfo import ZoneInfo
D=os.path.dirname(os.path.abspath(__file__))+'/../data'
URL='https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{}/gamelog?season={}'
d=pd.read_csv(D+'/raw.csv',dtype=str); q=d[d.cmp.notna()&d.date.notna()]
ALIAS={'WAS':'WSH','WSH':'WSH','LA':'LAR','AZ':'ARI'}
norm=lambda a:ALIAS.get(a.upper(),a.upper())
out={'source':'ESPN public athlete gamelog API (site.web.api.espn.com)','fetched':dt.datetime.now(ZoneInfo('America/New_York')).isoformat(timespec='seconds'),'players':{},'mismatches':[],'unmatched':[]}
for pid,rows in q.groupby('player_id'):
    season=int(float(rows.season.iloc[0]))
    try:
        req=urllib.request.Request(URL.format(pid,season),headers={'User-Agent':'Mozilla/5.0 (theplayerprops data refresh)'})
        j=json.load(urllib.request.urlopen(req,timeout=20))
    except Exception as e:
        out['unmatched'].append({'id':pid,'name':rows.player_name.iloc[0],'error':str(e)}); time.sleep(1.5); continue
    names=j.get('names',[]); idx={n:i for i,n in enumerate(names)}
    ev=j.get('events',{}); stats={}
    for st in j.get('seasonTypes',[]):
        if 'Regular' not in st.get('displayName','') and 'Post' not in st.get('displayName',''): continue
        for c in st.get('categories',[]):
            for e in c.get('events',[]): stats[e['eventId']]=e['stats']
    by={}
    for eid,s in stats.items():
        e=ev.get(eid);
        if not e or 'rushingAttempts' not in idx: continue
        t=dt.datetime.fromisoformat(e['gameDate'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York'))
        num=lambda k: float(s[idx[k]].replace(',','')) if s[idx[k]] not in ('','-','--') else None
        by[(f'{t.month}/{t.day}',norm(e['opponent']['abbreviation']))]={'car':num('rushingAttempts'),'rushYds':num('rushingYards'),'rushTd':num('rushingTouchdowns'),'eventId':eid}
    games=[]
    for _,r in rows.iterrows():
        key=(r.date.split()[1], norm(r.opp.replace('@','').replace('vs','')))
        g=by.get(key); csvcar=float(r.car) if pd.notna(r.car) else None
        if not g: out['unmatched'].append({'id':pid,'name':r.player_name,'date':r.date,'opp':r.opp}); continue
        if g['car']!=csvcar: out['mismatches'].append({'id':pid,'name':r.player_name,'date':r.date,'opp':r.opp,'csvCar':csvcar,'espnCar':g['car']}); continue
        games.append({'date':r.date,'opp':r.opp,**g})
    if games: out['players'][pid]={'name':rows.player_name.iloc[0],'games':games}
    time.sleep(1.5)
os.makedirs(D+'/supplemental',exist_ok=True)
json.dump(out,open(D+'/supplemental/qb-rushing.json','w'),indent=1)
print(len(out['players']),'QBs',sum(len(p['games']) for p in out['players'].values()),'games;',len(out['mismatches']),'mismatches;',len(out['unmatched']),'unmatched')
