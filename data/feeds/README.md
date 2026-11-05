# Game conditions feeds
The live drop-in file is `data/week-N-conditions.json`. Shape: `{week, updated, games:[{away, home, weather, injuries, with_without, kickoff_et?, inactives?, inactives_note?}]}`. Injuries may include `note` and `practice_latest` (shown on the matchup injury list). `inactives` may be absent; the page still renders the note. Team abbreviations: `WAS` is accepted for Washington (not `WSH`). The loader reads `data/week-N-conditions.json` first and falls back to `data/feeds/week-N-conditions.json`.

## Auto refresh (unattended)
- `scripts/refresh_injuries.py` pulls free public ESPN injury JSON (`https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries`), updates only `injuries` (+ `practice_latest` / `note` when present), and preserves weather, with_without, kickoff_et, and inactives. Fail closed on empty/broken payloads. No odds.
- `.github/workflows/refresh-injuries.yml` runs that script on injury-report windows (Wed–Sun morning/afternoon ET, plus Sunday inactives) and on `workflow_dispatch`, then commits `data/week-N-conditions.json` when it changed. Vercel deploys from the push.
- `/injuries` reads the current week’s curated `data/week-N-injury-analysis.json` when present; otherwise it builds the desk from `data/week-N-conditions.json`, so an ESPN refresh shows up with nobody touching the site.

## Kenzie’s local feed (box only)
Kenzie’s richer drop lives at `/workspace/feeds/week-N-conditions.json` (outside git; GitHub Actions cannot see it). On the box, run:

```bash
python3 scripts/import_kenzie_feed.py            # merge into data/week-N-conditions.json
python3 scripts/import_kenzie_feed.py --commit   # also git commit
python3 scripts/import_kenzie_feed.py --commit --push
```

Same fail-closed validation as the ESPN path. Kenzie’s rows win on `(team, player)`; weather / with_without / kickoff_et / inactives she sends also win. Field names stay exactly as Best Props, Sleepers, and matchups already read.
