#!/usr/bin/env python3
"""
NFL weekly matchup scraper + matchup strength/weakness analyzer.

Inputs
------
- all_team_stats.json
  Your existing NFL team-stat dump. The script uses its 2026 season data
  (or --season) and does NOT re-scrape the stats.

Schedule sources
----------------
1. NFL.com weekly schedule page (official)
2. ESPN public scoreboard endpoint (fallback)
3. nflverse schedules.csv (fallback)

Outputs
-------
- weekly_matchups.json
- weekly_matchups.csv
- team_strengths_weaknesses.csv

Install:
    pip install requests beautifulsoup4 lxml pandas

Examples:
    python nfl_weekly_matchups.py --stats all_team_stats.json --season 2026 --week 7
    python nfl_weekly_matchups.py --stats all_team_stats.json --season 2026 --week 7 --out results
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from zoneinfo import ZoneInfo

import pandas as pd
import requests
from bs4 import BeautifulSoup


TEAM_ALIASES = {
    "ARI": "Cardinals", "ATL": "Falcons", "BAL": "Ravens", "BUF": "Bills",
    "CAR": "Panthers", "CHI": "Bears", "CIN": "Bengals", "CLE": "Browns",
    "DAL": "Cowboys", "DEN": "Broncos", "DET": "Lions", "GB": "Packers",
    "HOU": "Texans", "IND": "Colts", "JAX": "Jaguars", "JAC": "Jaguars", "KC": "Chiefs",
    "LAC": "Chargers", "LAR": "Rams", "LA": "Rams", "LV": "Raiders", "MIA": "Dolphins",
    "MIN": "Vikings", "NE": "Patriots", "NO": "Saints", "NYG": "Giants",
    "NYJ": "Jets", "PHI": "Eagles", "PIT": "Steelers", "SEA": "Seahawks",
    "SF": "49ers", "TB": "Buccaneers", "TEN": "Titans", "WAS": "Commanders", "WSH": "Commanders",
}
ALL_NICKS = sorted(set(TEAM_ALIASES.values()))
NET_LABELS = {
    "prime video": "PRIME", "amazon prime video": "PRIME", "nfl network": "NFLN",
    "espn": "ESPN", "espn+": "ESPN+", "abc": "ABC", "fox": "FOX", "cbs": "CBS",
    "nbc": "NBC", "nfl+": "NFL+", "peacock": "PEACOCK", "youtube": "YOUTUBE",
}
BETTING_KEYS = ("odds", "spread", "moneyline", "sportsbook", "parlay", "juice", "bookmaker")

NAME_TO_TEAM = {v.lower(): v for v in TEAM_ALIASES.values()}
NAME_TO_TEAM.update({
    "los angeles rams": "Rams",
    "la rams": "Rams",
    "los angeles chargers": "Chargers",
    "la chargers": "Chargers",
    "new england patriots": "Patriots",
    "new york giants": "Giants",
    "new york jets": "Jets",
    "san francisco 49ers": "49ers",
    "tampa bay buccaneers": "Buccaneers",
    "green bay packers": "Packers",
    "kansas city chiefs": "Chiefs",
    "las vegas raiders": "Raiders",
    "jacksonville jaguars": "Jaguars",
    "new orleans saints": "Saints",
    "washington commanders": "Commanders",
    "indianapolis colts": "Colts",
    "arizona cardinals": "Cardinals",
    "atlanta falcons": "Falcons",
    "baltimore ravens": "Ravens",
    "buffalo bills": "Bills",
    "carolina panthers": "Panthers",
    "chicago bears": "Bears",
    "cincinnati bengals": "Bengals",
    "cleveland browns": "Browns",
    "dallas cowboys": "Cowboys",
    "denver broncos": "Broncos",
    "detroit lions": "Lions",
    "houston texans": "Texans",
    "miami dolphins": "Dolphins",
    "minnesota vikings": "Vikings",
    "philadelphia eagles": "Eagles",
    "pittsburgh steelers": "Steelers",
    "seattle seahawks": "Seahawks",
    "tennessee titans": "Titans",
})


def clean_team(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    if s in TEAM_ALIASES:
        return TEAM_ALIASES[s]
    s2 = re.sub(r"\s+", " ", s).lower()
    if s2 in NAME_TO_TEAM:
        return NAME_TO_TEAM[s2]
    # Your NFL stats file uses names such as "Rams Rams".
    first = s2.split()[0] if s2 else ""
    if first in NAME_TO_TEAM:
        return NAME_TO_TEAM[first]
    for full, short in NAME_TO_TEAM.items():
        if full in s2 or s2 in full:
            return short
    return None


def to_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    s = str(value).replace(",", "").replace("%", "").strip()
    if s.upper() in {"T", "—", "-", "N/A", "NA"}:
        return None
    s = re.sub(r"[^0-9.\-]", "", s)
    if not s or s in {"-", "."}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def reject_betting(obj: Any) -> None:
    """Raise if a field name would publish a betting line. Values are not scanned."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            lowered = str(key).lower()
            if any(word in lowered for word in BETTING_KEYS):
                raise RuntimeError(f"refusing to write betting field {key}")
            reject_betting(value)
    elif isinstance(obj, list):
        for value in obj:
            reject_betting(value)


def to_et_iso(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value:
        return None
    text = value.strip()
    try:
        if "T" in text:
            parsed = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=ZoneInfo("America/New_York"))
            return parsed.astimezone(ZoneInfo("America/New_York")).isoformat(timespec="seconds")
        if re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}", text):
            parsed = dt.datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo("America/New_York"))
            return parsed.isoformat(timespec="seconds")
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            parsed = dt.datetime.strptime(text + " 12:00", "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo("America/New_York"))
            return parsed.isoformat(timespec="seconds")
    except ValueError:
        return None
    return None


def network_label(comp: dict) -> Optional[str]:
    labels: List[str] = []
    for broadcast in comp.get("broadcasts") or []:
        for name in broadcast.get("names") or []:
            label = NET_LABELS.get(str(name).strip().lower(), str(name).strip())
            if label and label not in labels:
                labels.append(label)
    return " / ".join(labels) if labels else None


def request_json(url: str, timeout: int = 20) -> Any:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 Chrome/155 Safari/537.36"
        ),
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    }
    r = requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.json()


def recursive_game_objects(obj: Any) -> Iterable[dict]:
    """Find dictionaries that look like NFL game objects inside hydrated page JSON."""
    if isinstance(obj, dict):
        keys = {str(k).lower() for k in obj.keys()}
        if (
            ("hometeam" in keys or "home_team" in keys or "home" in keys)
            and ("awayteam" in keys or "away_team" in keys or "away" in keys)
        ):
            yield obj
        for v in obj.values():
            yield from recursive_game_objects(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from recursive_game_objects(v)


def find_value(obj: Any, names: List[str]) -> Any:
    wanted = {n.lower() for n in names}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if str(k).lower() in wanted:
                return v
        for v in obj.values():
            got = find_value(v, names)
            if got is not None:
                return got
    return None


def parse_nfl_hydration(season: int, week: int) -> List[dict]:
    """
    NFL.com is the preferred source. NFL's schedule pages use hydrated JSON;
    this parser intentionally searches the JSON recursively so minor page
    layout changes do not break CSS selectors.
    """
    url = f"https://www.nfl.com/schedules/{season}/by-week/week-{week}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 Chrome/155 Safari/537.36"
        )
    }
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    candidates = []

    # Next.js / hydration blobs.
    for script in soup.find_all("script"):
        txt = script.string or script.get_text()
        if not txt or len(txt) < 20:
            continue
        if "__NEXT_DATA__" in str(script.get("id", "")) or txt.lstrip().startswith("{"):
            try:
                candidates.append(json.loads(txt))
            except Exception:
                pass

    games = []
    seen = set()

    def extract_team(x):
        if isinstance(x, str):
            return clean_team(x)
        if isinstance(x, dict):
            name = (
                x.get("displayName") or x.get("fullName") or x.get("name")
                or x.get("shortDisplayName") or x.get("abbreviation")
            )
            return clean_team(name)
        return None

    for root in candidates:
        for g in recursive_game_objects(root):
            away = find_value(g, ["awayTeam", "away_team", "away"])
            home = find_value(g, ["homeTeam", "home_team", "home"])
            away_team = extract_team(away)
            home_team = extract_team(home)
            if not away_team or not home_team:
                continue

            game_id = (
                g.get("id") or g.get("gameId") or g.get("game_id")
                or f"{away_team}@{home_team}"
            )
            if game_id in seen:
                continue
            seen.add(game_id)

            date = find_value(g, ["date", "kickoff", "kickoffTime", "startTime"])
            venue = find_value(g, ["venue", "stadium", "location"])
            games.append({
                "season": season,
                "week": week,
                "game_id": str(game_id),
                "away_team": away_team,
                "home_team": home_team,
                "kickoff": date,
                "venue": venue,
                "source": url,
            })

    # If hydration structure changes, use the visible page text as a last NFL.com fallback.
    if not games:
        text = soup.get_text(" ", strip=True)
        # This is intentionally conservative: it only catches recognizable
        # "Team at Team" strings and deduplicates them.
        pattern = re.compile(
            r"([A-Z][A-Za-z .'-]+?)\s+at\s+([A-Z][A-Za-z .'-]+?)(?=,|\s+(?:Thursday|Sunday|Monday)|$)"
        )
        for m in pattern.finditer(text):
            a, h = clean_team(m.group(1)), clean_team(m.group(2))
            if a and h and a != h:
                key = (a, h)
                if key not in seen:
                    seen.add(key)
                    games.append({
                        "season": season, "week": week,
                        "game_id": f"{a}@{h}",
                        "away_team": a, "home_team": h,
                        "kickoff": None, "venue": None, "source": url,
                    })

    return games


def parse_espn_schedule(season: int, week: int) -> Tuple[List[dict], List[str], str]:
    """Public ESPN scoreboard JSON. Betting objects on the payload are ignored."""
    url = (
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
        f"?dates={season}&seasontype=2&week={week}"
    )
    data = request_json(url)
    games = []

    for event in data.get("events", []):
        comp = (event.get("competitions") or [{}])[0]
        competitors = comp.get("competitors") or []
        away = next((c for c in competitors if c.get("homeAway") == "away"), None)
        home = next((c for c in competitors if c.get("homeAway") == "home"), None)
        if not away or not home:
            continue

        away_team = clean_team(
            (away.get("team") or {}).get("displayName")
            or (away.get("team") or {}).get("abbreviation")
        )
        home_team = clean_team(
            (home.get("team") or {}).get("displayName")
            or (home.get("team") or {}).get("abbreviation")
        )
        if not away_team or not home_team:
            continue

        venue = ((comp.get("venue") or {}).get("fullName")
                 or ((comp.get("venue") or {}).get("address") or {}).get("city"))

        games.append({
            "season": season,
            "week": week,
            "game_id": event.get("id"),
            "away_team": away_team,
            "home_team": home_team,
            "kickoff": to_et_iso(event.get("date")),
            "network": network_label(comp),
            "venue": venue,
            "source": url,
        })
    byes = []
    for team in (data.get("week") or {}).get("teamsOnBye") or []:
        nick = clean_team((team or {}).get("abbreviation") or (team or {}).get("name"))
        if nick:
            byes.append(nick)
    return games, sorted(set(byes)), url


def parse_nflverse_schedule(season: int, week: int) -> Tuple[List[dict], List[str], str]:
    """
    Fallback schedule. nflverse games.csv also carries betting columns
    (moneyline, spread, total). Those columns are never copied.
    """
    url = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv"
    df = pd.read_csv(url)
    df = df[(df["season"] == season) & (df["game_type"] == "REG") & (df["week"] == week)]
    games = []
    playing = set()
    for _, r in df.iterrows():
        away = clean_team(r.get("away_team"))
        home = clean_team(r.get("home_team"))
        if not away or not home:
            continue
        playing.add(away)
        playing.add(home)
        kick = None
        gameday, gametime = r.get("gameday"), r.get("gametime")
        if isinstance(gameday, str) and isinstance(gametime, str) and gametime.strip():
            kick = to_et_iso(f"{gameday} {gametime.strip()[:5]}")
        elif isinstance(gameday, str):
            kick = to_et_iso(gameday)
        stadium = r.get("stadium")
        games.append({
            "season": season,
            "week": week,
            "game_id": r.get("game_id"),
            "away_team": away,
            "home_team": home,
            "kickoff": kick,
            "network": None,
            "venue": None if pd.isna(stadium) else stadium,
            "source": url,
        })
    byes = sorted(nick for nick in ALL_NICKS if nick not in playing)
    return games, byes, url


def get_schedule(season: int, week: int, allow_nfl_html: bool = False) -> Tuple[List[dict], str, List[str]]:
    """ESPN public JSON, then nflverse. NFL.com HTML only with allow_nfl_html."""
    errors = []
    steps = [
        ("ESPN", parse_espn_schedule),
        ("nflverse", parse_nflverse_schedule),
    ]
    if allow_nfl_html:
        nfl_url = f"https://www.nfl.com/schedules/{season}/by-week/week-{week}"
        steps.append(("NFL.com", lambda s, w: (parse_nfl_hydration(s, w), [], nfl_url)))

    for name, fn in steps:
        try:
            games, byes, url = fn(season, week)
            if games:
                unique = {}
                for game in games:
                    unique[(game["away_team"], game["home_team"])] = game
                return list(unique.values()), url or name, byes
            errors.append(f"{name}: returned no games")
        except Exception as exc:
            errors.append(f"{name}: {exc}")

    raise RuntimeError(
        "Could not retrieve the schedule. Sources tried:\n- "
        + "\n- ".join(errors)
    )


def load_stats(path: Path, season: int) -> Dict[str, Dict[str, Dict[str, dict]]]:
    raw = json.loads(path.read_text())
    stats: Dict[str, Dict[str, Dict[str, dict]]] = {}

    for row in raw:
        if int(row.get("season", -1)) != season or row.get("season_type") != "reg":
            continue
        team = clean_team(row.get("Team"))
        if not team:
            continue
        unit = row.get("unit")
        category = row.get("category")
        stats.setdefault(team, {}).setdefault(unit, {})[category] = row

    return stats


def val(stats, team: str, unit: str, category: str, field: str) -> Optional[float]:
    try:
        return to_float(stats[team][unit][category].get(field))
    except KeyError:
        return None


def pct_rank(values: Dict[str, Optional[float]], higher_is_better: bool) -> Dict[str, Optional[float]]:
    usable = {k: v for k, v in values.items() if v is not None and math.isfinite(v)}
    if not usable:
        return {k: None for k in values}

    s = pd.Series(usable, dtype=float)
    ranks = s.rank(pct=True, method="average")
    if not higher_is_better:
        ranks = 1.0 - ranks + (1.0 / len(s))
    return {k: (float(ranks[k]) if k in ranks else None) for k in values}


def build_metric_percentiles(stats: dict) -> Dict[str, Dict[str, float]]:
    """
    Returns team -> metric -> percentile score (0..1).
    Positive percentile always means "better for the team".
    """
    raw: Dict[str, Dict[str, Optional[float]]] = {t: {} for t in stats}

    specs = [
        # label, unit, category, field, higher_is_better
        ("pass_ypa", "offense", "passing", "Yds/Att", True),
        ("pass_rate", "offense", "passing", "Rate", True),
        ("pass_td", "offense", "passing", "TD", True),
        ("pass_int", "offense", "passing", "INT", False),
        ("pass_sacks", "offense", "passing", "Sck", False),
        ("rush_ypc", "offense", "rushing", "YPC", True),
        ("rush_1st_pct", "offense", "rushing", "Rush 1st%", True),
        ("rush_fum", "offense", "rushing", "Rush FUM", False),
        ("rec_ypc", "offense", "receiving", "Yds/Rec", True),
        ("rec_1st_pct", "offense", "receiving", "Rec 1st%", True),
        ("rec_fum", "offense", "receiving", "Rec FUM", False),
        ("def_pass_ypa_allowed", "defense", "passing", "Yds/Att", False),
        ("def_pass_rate_allowed", "defense", "passing", "Rate", False),
        ("def_pass_td_allowed", "defense", "passing", "TD", False),
        ("def_int", "defense", "interceptions", "INT", True),
        ("def_rush_ypc_allowed", "defense", "rushing", "YPC", False),
        ("def_rush_td_allowed", "defense", "rushing", "TD", False),
        ("def_sacks", "defense", "tackles", "Sck", True),
        ("def_ff", "defense", "fumbles", "FF", True),
        ("def_fr", "defense", "fumbles", "FR", True),
        ("off_3rd_down", "offense", "downs", "3rd Md", True),
        ("off_3rd_attempts", "offense", "downs", "3rd Att", False),
    ]

    for label, unit, cat, field, _ in specs:
        for team in stats:
            raw[team][label] = val(stats, team, unit, cat, field)

    out = {t: {} for t in stats}
    for label, unit, cat, field, higher in specs:
        vals = {t: raw[t][label] for t in stats}
        ranks = pct_rank(vals, higher)
        for t, score in ranks.items():
            if score is not None:
                out[t][label] = score
    return out


def top_strengths_weaknesses(percentiles: dict, n: int = 5) -> Tuple[List[str], List[str]]:
    pretty = {
        "pass_ypa": "Pass efficiency",
        "pass_rate": "QB/pass rating",
        "pass_td": "Passing TD production",
        "pass_int": "Ball security through the air",
        "pass_sacks": "Pass protection",
        "rush_ypc": "Rush efficiency",
        "rush_1st_pct": "Rush first-down rate",
        "rush_fum": "Rush ball security",
        "rec_ypc": "Receiving efficiency",
        "rec_1st_pct": "Receiving first-down rate",
        "rec_fum": "Receiving ball security",
        "def_pass_ypa_allowed": "Pass defense",
        "def_pass_rate_allowed": "Pass coverage",
        "def_pass_td_allowed": "Pass TD prevention",
        "def_int": "Interceptions",
        "def_rush_ypc_allowed": "Run defense",
        "def_rush_td_allowed": "Rush TD prevention",
        "def_sacks": "Pass rush",
        "def_ff": "Forced fumbles",
        "def_fr": "Fumble recoveries",
        "off_3rd_down": "Third-down conversion",
    }
    usable = [(k, v) for k, v in percentiles.items() if v is not None]
    usable.sort(key=lambda x: x[1], reverse=True)
    strengths = [pretty.get(k, k) for k, _ in usable[:n]]
    weaknesses = [pretty.get(k, k) for k, _ in usable[-n:]]
    return strengths, list(reversed(weaknesses))


def matchup_edge(
    p: Dict[str, float],
    away: str,
    home: str,
) -> Dict[str, Any]:
    """
    Positive score = advantage to away team.
    Negative score = advantage to home team.
    """
    def g(team, metric):
        return p.get(team, {}).get(metric)

    pairs = {
        "passing": ("pass_ypa", "def_pass_ypa_allowed"),
        "rushing": ("rush_ypc", "def_rush_ypc_allowed"),
        "passing_protection_vs_pass_rush": ("pass_sacks", "def_sacks"),
        "third_down": ("off_3rd_down", "off_3rd_down"),
    }

    # For each side, combine its offense percentile with the opponent's
    # defensive vulnerability percentile.
    def attack_score(team, opponent, off_metric, def_metric):
        a = g(team, off_metric)
        b = g(opponent, def_metric)
        if a is None or b is None:
            return None
        return (a + b) / 2.0

    categories = {}
    for label, (off_metric, def_metric) in pairs.items():
        away_score = attack_score(away, home, off_metric, def_metric)
        home_score = attack_score(home, away, off_metric, def_metric)
        if away_score is None or home_score is None:
            categories[label] = {"away": away_score, "home": home_score, "edge": None}
        else:
            categories[label] = {
                "away": round(away_score, 4),
                "home": round(home_score, 4),
                "edge": round(away_score - home_score, 4),
            }

    valid_edges = [x["edge"] for x in categories.values() if x["edge"] is not None]
    overall = sum(valid_edges) / len(valid_edges) if valid_edges else None

    if overall is None:
        lean = "insufficient data"
    elif overall > 0.08:
        lean = f"{away} clear matchup edge"
    elif overall > 0.025:
        lean = f"{away} slight matchup edge"
    elif overall < -0.08:
        lean = f"{home} clear matchup edge"
    elif overall < -0.025:
        lean = f"{home} slight matchup edge"
    else:
        lean = "very close matchup"

    return {
        "away_team": away,
        "home_team": home,
        "overall_edge": round(overall, 4) if overall is not None else None,
        "lean": lean,
        "categories": categories,
    }


def build_outputs(schedule, stats, percentiles):
    strengths = []
    for team in sorted(stats):
        s, w = top_strengths_weaknesses(percentiles.get(team, {}))
        strengths.append({
            "team": team,
            "strengths": s,
            "weaknesses": w,
        })

    team_lookup = {x["team"]: x for x in strengths}

    matchups = []
    for game in schedule:
        away, home = game["away_team"], game["home_team"]
        if away not in stats or home not in stats:
            missing = [t for t in (away, home) if t not in stats]
            game["analysis_error"] = f"Missing team stats: {missing}"
            matchups.append(game)
            continue

        analysis = matchup_edge(percentiles, away, home)
        game = dict(game)
        game["analysis"] = analysis
        game["away_strengths"] = team_lookup[away]["strengths"]
        game["away_weaknesses"] = team_lookup[away]["weaknesses"]
        game["home_strengths"] = team_lookup[home]["strengths"]
        game["home_weaknesses"] = team_lookup[home]["weaknesses"]
        matchups.append(game)

    flat = []
    for g in matchups:
        a = g["analysis"] if "analysis" in g else {}
        flat.append({
            "season": g["season"],
            "week": g["week"],
            "game_id": g.get("game_id"),
            "kickoff": g.get("kickoff"),
            "away_team": g["away_team"],
            "home_team": g["home_team"],
            "venue": g.get("venue"),
            "source": g.get("source"),
            "matchup_lean": a.get("lean"),
            "overall_edge_away": a.get("overall_edge"),
            "passing_edge": (a.get("categories", {}).get("passing") or {}).get("edge"),
            "rushing_edge": (a.get("categories", {}).get("rushing") or {}).get("edge"),
            "protection_pass_rush_edge": (
                a.get("categories", {}).get("passing_protection_vs_pass_rush") or {}
            ).get("edge"),
            "third_down_edge": (a.get("categories", {}).get("third_down") or {}).get("edge"),
            "away_strengths": "; ".join(g.get("away_strengths", [])),
            "away_weaknesses": "; ".join(g.get("away_weaknesses", [])),
            "home_strengths": "; ".join(g.get("home_strengths", [])),
            "home_weaknesses": "; ".join(g.get("home_weaknesses", [])),
        })

    return matchups, strengths, flat


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", default="all_team_stats.json")
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--week", type=int, required=True)
    ap.add_argument("--out", default="nfl_matchup_output")
    ap.add_argument("--allow-nfl-html", action="store_true",
                    help="Also try NFL.com HTML. Manual only; CI must not set this.")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    stats_path = Path(args.stats)
    stats = load_stats(stats_path, args.season)
    if len(stats) < 30:
        raise RuntimeError(
            f"Only {len(stats)} teams found in {stats_path}; expected about 32."
        )

    schedule, source, byes = get_schedule(args.season, args.week, allow_nfl_html=args.allow_nfl_html)
    percentiles = build_metric_percentiles(stats)
    matchups, team_strengths, flat = build_outputs(schedule, stats, percentiles)

    payload = {
        "season": args.season,
        "week": args.week,
        "schedule_source": source,
        "byes": byes,
        "schedule_game_count": len(matchups),
        "matchups": matchups,
        "team_strengths_weaknesses": team_strengths,
    }
    reject_betting(payload)

    (out / "weekly_matchups.json").write_text(json.dumps(payload, indent=2, default=str))
    pd.DataFrame(flat).to_csv(out / "weekly_matchups.csv", index=False)
    pd.DataFrame(team_strengths).to_csv(out / "team_strengths_weaknesses.csv", index=False)

    print(f"Schedule source: {source}")
    print(f"Games found: {len(matchups)}")
    print(f"Output directory: {out.resolve()}")
    print()
    for g in flat:
        print(f"{g['away_team']} @ {g['home_team']}: {g['matchup_lean']}")


if __name__ == "__main__":
    main()
