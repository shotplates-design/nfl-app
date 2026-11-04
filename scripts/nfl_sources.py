"""Shared helpers for the nflverse-first refresh. No secrets. No betting fields."""
from __future__ import annotations

import csv
import datetime as dt
import json
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

UA = "Mozilla/5.0 (theplayerprops data refresh)"
BETTING_KEYS = ("odds", "spread", "moneyline", "sportsbook", "parlay", "juice", "bookmaker")

NFLVERSE = "https://github.com/nflverse/nflverse-data/releases/download"
PLAYER_WEEK = NFLVERSE + "/stats_player/stats_player_week_{season}.csv"
TEAM_WEEK = NFLVERSE + "/stats_team/stats_team_week_{season}.csv"
ROSTER = NFLVERSE + "/rosters/roster_{season}.csv"
PLAYERS = NFLVERSE + "/players/players.csv"
GAMES = NFLVERSE + "/schedules/games.csv"

# nflverse uses LA and WAS. The site uses lar and wsh, and opponent codes LAR and WSH.
SITE = {
    "ARI": "ari", "ATL": "atl", "BAL": "bal", "BUF": "buf", "CAR": "car", "CHI": "chi",
    "CIN": "cin", "CLE": "cle", "DAL": "dal", "DEN": "den", "DET": "det", "GB": "gb",
    "HOU": "hou", "IND": "ind", "JAX": "jax", "JAC": "jax", "KC": "kc", "LAC": "lac",
    "LAR": "lar", "LA": "lar", "LV": "lv", "MIA": "mia", "MIN": "min", "NE": "ne",
    "NO": "no", "NYG": "nyg", "NYJ": "nyj", "PHI": "phi", "PIT": "pit", "SEA": "sea",
    "SF": "sf", "TB": "tb", "TEN": "ten", "WAS": "wsh", "WSH": "wsh",
}
OPP = {k: k for k in SITE}
OPP.update({"LA": "LAR", "LAR": "LAR", "WAS": "WSH", "WSH": "WSH", "JAC": "JAX", "JAX": "JAX"})
NICK = {
    "ARI": "Cardinals", "ATL": "Falcons", "BAL": "Ravens", "BUF": "Bills", "CAR": "Panthers",
    "CHI": "Bears", "CIN": "Bengals", "CLE": "Browns", "DAL": "Cowboys", "DEN": "Broncos",
    "DET": "Lions", "GB": "Packers", "HOU": "Texans", "IND": "Colts", "JAX": "Jaguars",
    "JAC": "Jaguars", "KC": "Chiefs", "LAC": "Chargers", "LAR": "Rams", "LA": "Rams",
    "LV": "Raiders", "MIA": "Dolphins", "MIN": "Vikings", "NE": "Patriots", "NO": "Saints",
    "NYG": "Giants", "NYJ": "Jets", "PHI": "Eagles", "PIT": "Steelers", "SEA": "Seahawks",
    "SF": "49ers", "TB": "Buccaneers", "TEN": "Titans", "WAS": "Commanders", "WSH": "Commanders",
}
NICK_CODE = {nick: SITE[abbr] for abbr, nick in NICK.items()}
DIVISIONS = {
    "AFC East": ["BUF", "MIA", "NE", "NYJ"],
    "AFC North": ["BAL", "CIN", "CLE", "PIT"],
    "AFC South": ["HOU", "IND", "JAX", "TEN"],
    "AFC West": ["DEN", "KC", "LAC", "LV"],
    "NFC East": ["DAL", "NYG", "PHI", "WAS"],
    "NFC North": ["CHI", "DET", "GB", "MIN"],
    "NFC South": ["ATL", "CAR", "NO", "TB"],
    "NFC West": ["ARI", "LA", "SF", "SEA"],
}
DIV_LABEL = {
    "ARI": "Arizona", "ATL": "Atlanta", "BAL": "Baltimore", "BUF": "Buffalo", "CAR": "Carolina",
    "CHI": "Chicago", "CIN": "Cincinnati", "CLE": "Cleveland", "DAL": "Dallas", "DEN": "Denver",
    "DET": "Detroit", "GB": "Green Bay", "HOU": "Houston", "IND": "Indianapolis", "JAX": "Jacksonville",
    "KC": "Kansas City", "LAC": "LA Chargers", "LA": "LA Rams", "LV": "Las Vegas", "MIA": "Miami",
    "MIN": "Minnesota", "NE": "New England", "NO": "New Orleans", "NYG": "NY Giants", "NYJ": "NY Jets",
    "PHI": "Philadelphia", "PIT": "Pittsburgh", "SEA": "Seattle", "SF": "San Francisco", "TB": "Tampa Bay",
    "TEN": "Tennessee", "WAS": "Washington",
}
WEEKDAY = {"Monday": "Mon", "Tuesday": "Tue", "Wednesday": "Wed", "Thursday": "Thu", "Friday": "Fri", "Saturday": "Sat", "Sunday": "Sun"}
CSV_COLUMNS = [
    "player_id", "player_name", "current_team", "season", "date", "opp", "result", "team",
    "cmp", "att", "yds", "td", "int", "rtg", "qbr", "sack", "lng", "car", "rec", "tgts", "avg", "fum",
    "tot", "solo", "pd", "stf", "ff", "fr", "fg", "pts", "xp", "punts", "in20", "net",
    "w", "l", "t", "pf", "pa",
]


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 500:
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as response, dest.open("wb") as handle:
        handle.write(response.read())
    return dest


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as handle:
        yield from csv.DictReader(handle)


class MissingColumn(SystemExit):
    """A source CSV lost a column we read. Fail loudly instead of writing zeros."""


def num(row: dict, col: str) -> float:
    if col not in row:
        raise MissingColumn(f"source row is missing expected column {col!r}; refusing to fill zeros")
    value = row[col]
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def reject_betting(obj, path="$") -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            lowered = str(key).lower()
            if any(word in lowered for word in BETTING_KEYS):
                raise SystemExit(f"refusing to write betting field {path}.{key}")
            reject_betting(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            reject_betting(value, f"{path}[{index}]")


def dump_json(path: Path, payload) -> None:
    reject_betting(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=1), encoding="utf-8")


def passer_rating(completions: float, attempts: float, yards: float, touchdowns: float, interceptions: float):
    if attempts <= 0:
        return None

    def clamp(value: float) -> float:
        return max(0.0, min(2.375, value))

    rating = (
        clamp((completions / attempts - 0.3) * 5)
        + clamp((yards / attempts - 3) * 0.25)
        + clamp((touchdowns / attempts) * 20)
        + clamp(2.375 - (interceptions / attempts) * 25)
    ) / 6 * 100
    return round(rating, 1)


def date_label(gameday: str, weekday: str) -> str:
    year, month, day = (int(part) for part in gameday.split("-"))
    short = WEEKDAY.get(weekday) or dt.date(year, month, day).strftime("%a")
    return f"{short} {month}/{day}"


def result_text(mine: int, theirs: int, overtime: str) -> str:
    suffix = " OT" if str(overtime) in {"1", "True", "true"} else ""
    if mine > theirs:
        return f"W{mine}-{theirs}{suffix}"
    if mine < theirs:
        return f"L{theirs}-{mine}{suffix}"
    return f"T{mine}-{theirs}{suffix}"


def now_et() -> dt.datetime:
    return dt.datetime.now(ZoneInfo("America/New_York"))
