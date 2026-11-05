"""Walk-forward grade Best Props and ship param changes only when not worse.

Each refresh:
  1. Grade completed weeks with a walk-forward rebuild of Best Props (using only
     games dated before that week's first kickoff).
  2. Append the hit rate into data/accuracy-history.json.
  3. Try a small grid of Best Props rate pairs. Keep a candidate only when its
     walk-forward hit rate is at least as high as the current params.
  4. Snapshot this week's published Best Props for later grading.

Hard rules (never relaxed here):
  - hit_rate_floor stays 0.6
  - targets and tackles are never props
  - no odds / sportsbook fields
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NICK = {
    "Cardinals": "ari", "Falcons": "atl", "Ravens": "bal", "Bills": "buf",
    "Panthers": "car", "Bears": "chi", "Bengals": "cin", "Browns": "cle",
    "Cowboys": "dal", "Broncos": "den", "Lions": "det", "Packers": "gb",
    "Texans": "hou", "Colts": "ind", "Jaguars": "jax", "Chiefs": "kc",
    "Chargers": "lac", "Rams": "lar", "Raiders": "lv", "Dolphins": "mia",
    "Vikings": "min", "Patriots": "ne", "Saints": "no", "Giants": "nyg",
    "Jets": "nyj", "Eagles": "phi", "Steelers": "pit", "Seahawks": "sea",
    "49ers": "sf", "Buccaneers": "tb", "Titans": "ten", "Commanders": "wsh",
}
ROLE = {
    "passing": "QB", "rushing": "RB", "receiving": "WR/TE",
    "defense": "DEF", "kicking": "K", "punting": "P",
}
# Best Props only. Targets and tackles intentionally absent.
BEST_PROPS = {
    "QB": ["passYds", "passTd", "rushYds"],
    "RB": ["rushYds", "recYds", "rec"],
    "WR/TE": ["recYds", "rec"],
}
# key -> (field on game row, categories)
STAT_FIELD = {
    "passYds": ("passYds", ["passing"]),
    "passTd": ("passTd", ["passing"]),
    "rushYds": ("primYds", ["rushing", "passing"]),
    "recYds": ("primYds", ["receiving"]),
    "rec": ("rec", ["receiving", "rushing"]),
}
MIN_LINE = {
    ("WR/TE", "rec"): 5,
    ("RB", "rec"): 3,
    ("QB", "passTd"): 2,
}
DEFAULT_MIN_YDS = 10
HIT_FLOOR = 0.6
FORBIDDEN_PROPS = {"tgts", "tackles"}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")


def parse_log_date(raw: str, season: int) -> date | None:
    """'Sun 9/13' -> calendar date. Season year is the Sep start year."""
    if not raw or not isinstance(raw, str):
        return None
    try:
        md = raw.strip().split()[-1]
        month, day = (int(x) for x in md.split("/"))
    except (ValueError, IndexError):
        return None
    year = season if month >= 8 else season + 1
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_kickoff(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def min_line(role: str, key: str) -> int:
    if (role, key) in MIN_LINE:
        return MIN_LINE[(role, key)]
    if key.endswith("Yds"):
        return DEFAULT_MIN_YDS
    return 1


def step(key: str) -> int:
    return 5 if key.endswith("Yds") else 1


def series(player: dict, key: str) -> list[tuple[date, float]]:
    field, cats = STAT_FIELD[key]
    out: list[tuple[date, float]] = []
    season = int(player.get("season") or 2026)
    for game in player.get("games") or []:
        if game.get("cat") not in cats:
            continue
        val = game.get(field)
        if not isinstance(val, (int, float)):
            continue
        d = parse_log_date(game.get("date") or "", season)
        if d is None:
            continue
        out.append((d, float(val)))
    out.sort(key=lambda x: x[0])
    return out


def pick_line(vals: list[float], key: str, rate: float, alt_rate: float) -> float:
    if not vals:
        return 0.0
    ordered = sorted(vals)
    st = step(key)

    def at(r: float) -> float:
        idx = min(len(ordered) - 1, max(0, math.floor(len(ordered) * (1 - r) + 1e-9)))
        return math.floor(ordered[idx] / st) * st

    a = at(rate)
    b = at(min(rate, alt_rate))
    n = len(ordered)
    med = ordered[n // 2] if n % 2 else (ordered[n // 2 - 1] + ordered[n // 2]) / 2
    if b >= a * 1.1 and abs(med - b) <= abs(med - a):
        return b
    return a


def pct(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, math.floor(q * len(ordered)))]


def positional_norms(players: list, before: date | None) -> dict[str, float]:
    norms: dict[str, float] = {}
    for role, keys in BEST_PROPS.items():
        for key in keys:
            avgs = []
            for player in players:
                if ROLE.get(player.get("cat")) != role:
                    continue
                vals = [v for d, v in series(player, key) if before is None or d < before]
                if len(vals) >= 3:
                    avgs.append(sum(vals) / len(vals))
            norms[role + key] = pct([a for a in avgs if a > 0], 0.75) or 1.0
    return norms


def best_prop_for_player(
    player: dict,
    before: date | None,
    norms: dict[str, float],
    min_rate: float,
    alt_rate: float,
) -> dict | None:
    role = ROLE.get(player.get("cat"))
    keys = BEST_PROPS.get(role or "")
    if not keys:
        return None
    best = None
    for key in keys:
        assert key not in FORBIDDEN_PROPS
        pairs = [(d, v) for d, v in series(player, key) if before is None or d < before]
        if len(pairs) < 3:
            continue
        vals = [v for _, v in pairs]
        line = pick_line(vals, key, min_rate, alt_rate)
        if line < min_line(role, key):
            continue
        hits = sum(1 for v in vals if v >= line)
        rate = hits / len(vals)
        if rate + 1e-9 < min(min_rate, alt_rate) - 1e-6:
            # still allow alt path; rate is measured against chosen line
            pass
        streak = 0
        for v in reversed(vals):
            if v >= line:
                streak += 1
            else:
                break
        avg = sum(vals) / len(vals)
        norm = norms.get(role + key, 1.0)
        diff = min(line / max(norm, 1e-6), 1.5)
        if diff < 0.6:
            continue
        score = (
            40 * rate
            + 30 * diff / 1.5
            + 4 * min(streak, 5)
            + 2 * min(len(vals), 6)
            + (10 if key.endswith("Yds") else 0)
        )
        row = {
            "slug": player.get("slug"),
            "name": player.get("name"),
            "team": player.get("team"),
            "role": role,
            "stat": key,
            "thr": line,
            "hits": hits,
            "games": len(vals),
            "rate": rate,
            "score": score,
            "avg": avg,
        }
        if best is None or score > best["score"]:
            best = row
    return best


def diversify(rows: list[dict], team_game: dict[str, str], limit: int = 18) -> list[dict]:
    pick: list[dict] = []

    def count(pred):
        return sum(1 for r in pick if pred(r))

    ordered = sorted(rows, key=lambda r: r["score"], reverse=True)
    for row in ordered:
        if len(pick) >= limit:
            break
        game = team_game.get(row["team"])
        if count(lambda x: x["team"] == row["team"]) >= 2:
            continue
        if game and count(lambda x: team_game.get(x["team"]) == game) >= 3:
            continue
        if count(lambda x: x["role"] == row["role"]) >= 6:
            continue
        pick.append(row)
    for role in ("QB", "RB", "WR/TE"):
        while count(lambda x: x["role"] == role) < 3:
            cand = next(
                (
                    r
                    for r in ordered
                    if r["role"] == role
                    and r not in pick
                    and count(lambda x: x["team"] == r["team"]) < 2
                ),
                None,
            )
            if not cand:
                break
            over = next(
                (
                    x
                    for x in reversed(pick)
                    if x["role"] != role and count(lambda y: y["role"] == x["role"]) > 3
                ),
                None,
            )
            if not over:
                break
            pick[pick.index(over)] = cand
    return sorted(pick, key=lambda r: r["score"], reverse=True)


def week_payload(path: Path) -> dict:
    week = load(path)
    games = []
    for g in week.get("games") or []:
        away_code = NICK.get(g["away"], str(g["away"]).lower())
        home_code = NICK.get(g["home"], str(g["home"]).lower())
        kick = parse_kickoff(g.get("kickoff") or "")
        games.append(
            {
                "away": g["away"],
                "home": g["home"],
                "awayCode": away_code,
                "homeCode": home_code,
                "kickoff": kick,
                "slug": f"{g['away']}-at-{g['home']}-{week.get('season')}-week-{week.get('week')}".lower().replace(
                    " ", "-"
                ),
            }
        )
    return {
        "season": int(week.get("season") or 2026),
        "week": int(week["week"]),
        "games": games,
        "byes": week.get("byes") or [],
    }


def team_game_map(week: dict) -> dict[str, str]:
    out = {}
    for g in week["games"]:
        out[g["awayCode"]] = g["slug"]
        out[g["homeCode"]] = g["slug"]
    return out


def team_opp(week: dict) -> dict[str, tuple[str, str]]:
    """team -> (opp_code, kickoff_date_iso_date)."""
    out = {}
    for g in week["games"]:
        kd = g["kickoff"].date() if g["kickoff"] else None
        out[g["awayCode"]] = (g["homeCode"], kd, "@")
        out[g["homeCode"]] = (g["awayCode"], kd, "vs")
    return out


def week_cutoff(week: dict) -> date | None:
    kicks = [g["kickoff"] for g in week["games"] if g["kickoff"]]
    if not kicks:
        return None
    return min(kicks).date()


def week_done(week: dict, now: datetime) -> bool:
    kicks = [g["kickoff"] for g in week["games"] if g["kickoff"]]
    if not kicks:
        return False
    # Grade once the last kickoff is more than a day old (results in logs).
    return max(kicks) + timedelta(days=1) < now


def find_result_value(player: dict, key: str, on_day: date, opp_code: str, at: str) -> float | None:
    field, cats = STAT_FIELD[key]
    season = int(player.get("season") or 2026)
    want_opp = f"{at}{opp_code.upper()}"
    # also accept vsXXX / @XXX regardless of case
    for game in player.get("games") or []:
        if game.get("cat") not in cats:
            continue
        d = parse_log_date(game.get("date") or "", season)
        if d != on_day:
            continue
        opp = str(game.get("opp") or "")
        if opp.lower() != want_opp.lower() and opp_code.upper() not in opp.upper():
            continue
        val = game.get(field)
        if isinstance(val, (int, float)):
            return float(val)
    # fallback: same calendar day any opp
    for game in player.get("games") or []:
        if game.get("cat") not in cats:
            continue
        d = parse_log_date(game.get("date") or "", season)
        if d != on_day:
            continue
        val = game.get(field)
        if isinstance(val, (int, float)):
            return float(val)
    return None


def build_week_props(
    players: list,
    week: dict,
    min_rate: float,
    alt_rate: float,
) -> list[dict]:
    before = week_cutoff(week)
    if before is None:
        return []
    norms = positional_norms(players, before)
    team_game = team_game_map(week)
    playing = set(team_game)
    rows = []
    for player in players:
        if player.get("team") not in playing:
            continue
        row = best_prop_for_player(player, before, norms, min_rate, alt_rate)
        if row:
            rows.append(row)
    return diversify(rows, team_game)


def grade_props(players: list, week: dict, props: list[dict]) -> dict:
    opp_map = team_opp(week)
    graded = []
    hits = 0
    for prop in props:
        team = prop["team"]
        if team not in opp_map:
            continue
        opp_code, on_day, at = opp_map[team]
        if on_day is None:
            continue
        player = next((p for p in players if p.get("slug") == prop.get("slug")), None)
        if player is None:
            player = next(
                (p for p in players if p.get("name") == prop.get("name") and p.get("team") == team),
                None,
            )
        if player is None:
            continue
        actual = find_result_value(player, prop["stat"], on_day, opp_code, at)
        if actual is None:
            continue
        hit = actual + 1e-9 >= float(prop["thr"])
        hits += int(hit)
        graded.append(
            {
                "slug": prop.get("slug"),
                "name": prop.get("name"),
                "team": team,
                "stat": prop["stat"],
                "thr": prop["thr"],
                "actual": actual,
                "hit": hit,
            }
        )
    n = len(graded)
    return {
        "week": week["week"],
        "season": week["season"],
        "n": n,
        "hits": hits,
        "hit_rate": (hits / n) if n else None,
        "props": graded,
    }


def walk_forward(
    players: list,
    weeks: list[dict],
    min_rate: float,
    alt_rate: float,
    now: datetime,
) -> dict:
    grades = []
    for week in weeks:
        if not week_done(week, now):
            continue
        props = build_week_props(players, week, min_rate, alt_rate)
        grade = grade_props(players, week, props)
        if grade["n"]:
            grades.append(grade)
    total_n = sum(g["n"] for g in grades)
    total_hits = sum(g["hits"] for g in grades)
    return {
        "weeks": grades,
        "n": total_n,
        "hits": total_hits,
        "hit_rate": (total_hits / total_n) if total_n else None,
        "min_rate": min_rate,
        "alt_rate": alt_rate,
    }


def default_params() -> dict:
    return {
        "hit_rate_floor": HIT_FLOOR,
        "best_props_min_rate": 0.8,
        "best_props_alt_rate": 0.7,
        "sleeper_rate": 0.75,
        "updated_at": None,
        "source": "baseline",
        "notes": (
            "Tunable Best Props / Sleepers rates. hit_rate_floor is fixed at 0.6 "
            "and never lowered. Targets and tackles are never props."
        ),
    }


def clamp_params(params: dict) -> dict:
    out = dict(params)
    out["hit_rate_floor"] = HIT_FLOOR
    out["best_props_min_rate"] = float(out.get("best_props_min_rate", 0.8))
    out["best_props_alt_rate"] = float(out.get("best_props_alt_rate", 0.7))
    out["sleeper_rate"] = float(out.get("sleeper_rate", 0.75))
    if out["best_props_min_rate"] < HIT_FLOOR:
        raise SystemExit("best_props_min_rate cannot fall below the 60% hit floor")
    if out["best_props_alt_rate"] < HIT_FLOOR:
        raise SystemExit("best_props_alt_rate cannot fall below the 60% hit floor")
    if out["sleeper_rate"] < HIT_FLOOR:
        raise SystemExit("sleeper_rate cannot fall below the 60% hit floor")
    if out["best_props_alt_rate"] > out["best_props_min_rate"]:
        out["best_props_alt_rate"] = out["best_props_min_rate"]
    return out


def candidate_grid(current: dict) -> list[tuple[float, float]]:
    rates = [0.75, 0.8, 0.85]
    alts = [0.65, 0.7, 0.75]
    pairs = {(round(r, 2), round(a, 2)) for r in rates for a in alts if a <= r and a >= HIT_FLOOR and r >= HIT_FLOOR}
    pairs.add(
        (
            round(float(current["best_props_min_rate"]), 2),
            round(float(current["best_props_alt_rate"]), 2),
        )
    )
    return sorted(pairs)


def current_week(weeks: list[dict]) -> dict | None:
    return max(weeks, key=lambda w: w["week"]) if weeks else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=ROOT / "data")
    parser.add_argument("--out", type=Path, help="Write params/history/snapshots here (default: --data)")
    parser.add_argument("--now", help="ISO timestamp override for tests")
    parser.add_argument("--no-tune", action="store_true", help="Grade and snapshot only; do not change params")
    args = parser.parse_args()
    data = args.data.resolve()
    out = (args.out or args.data).resolve()
    now = (
        datetime.fromisoformat(args.now)
        if args.now
        else datetime.now(timezone.utc).astimezone()
    )
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    players = load(data / "players.json")
    if not isinstance(players, list):
        raise SystemExit("players.json must be a list")
    week_files = sorted((data / "matchups").glob("week-*.json"))
    weeks = [week_payload(p) for p in week_files]
    params_path = data / "prop-params.json"
    params = clamp_params(load(params_path) if params_path.exists() else default_params())

    baseline = walk_forward(
        players,
        weeks,
        params["best_props_min_rate"],
        params["best_props_alt_rate"],
        now,
    )
    print(
        f"walk-forward baseline min={params['best_props_min_rate']} alt={params['best_props_alt_rate']}: "
        f"hits={baseline['hits']}/{baseline['n']} rate={baseline['hit_rate']}"
    )

    chosen = params
    chosen_wf = baseline
    improved = False
    if not args.no_tune and baseline["n"] >= 10:
        best = baseline
        best_pair = (params["best_props_min_rate"], params["best_props_alt_rate"])
        for min_rate, alt_rate in candidate_grid(params):
            if (min_rate, alt_rate) == best_pair:
                continue
            wf = walk_forward(players, weeks, min_rate, alt_rate, now)
            if wf["n"] < baseline["n"] * 0.9:
                continue
            if wf["hit_rate"] is None:
                continue
            if best["hit_rate"] is None or wf["hit_rate"] > best["hit_rate"] + 1e-9:
                best = wf
                best_pair = (min_rate, alt_rate)
            elif (
                abs((wf["hit_rate"] or 0) - (best["hit_rate"] or 0)) < 1e-9
                and abs(min_rate - 0.8) + abs(alt_rate - 0.7)
                < abs(best_pair[0] - 0.8) + abs(best_pair[1] - 0.7)
            ):
                # Prefer closer to the documented defaults on ties.
                best = wf
                best_pair = (min_rate, alt_rate)
        if best_pair != (params["best_props_min_rate"], params["best_props_alt_rate"]):
            if best["hit_rate"] is not None and (
                baseline["hit_rate"] is None or best["hit_rate"] + 1e-12 >= baseline["hit_rate"]
            ):
                chosen = clamp_params(
                    {
                        **params,
                        "best_props_min_rate": best_pair[0],
                        "best_props_alt_rate": best_pair[1],
                        "updated_at": now.isoformat(),
                        "source": "walkforward",
                    }
                )
                chosen_wf = best
                improved = True
                print(
                    f"params improved -> min={best_pair[0]} alt={best_pair[1]} "
                    f"hits={best['hits']}/{best['n']} rate={best['hit_rate']}"
                )
            else:
                print("no candidate beat the baseline; keeping current params")
        else:
            print("grid search kept the current params")
    elif args.no_tune:
        print("tuning skipped (--no-tune)")
    else:
        print(f"not enough graded props to tune yet (n={baseline['n']})")

    history_path = out / "accuracy-history.json"
    history = load(history_path) if history_path.exists() else {"runs": [], "weeks": {}}
    run_row = {
        "at": now.isoformat(),
        "params": {
            "best_props_min_rate": chosen["best_props_min_rate"],
            "best_props_alt_rate": chosen["best_props_alt_rate"],
            "sleeper_rate": chosen["sleeper_rate"],
            "hit_rate_floor": HIT_FLOOR,
        },
        "walk_forward": {
            "n": chosen_wf["n"],
            "hits": chosen_wf["hits"],
            "hit_rate": chosen_wf["hit_rate"],
        },
        "improved": improved,
        "baseline_hit_rate": baseline["hit_rate"],
    }
    history.setdefault("runs", []).append(run_row)
    history["runs"] = history["runs"][-60:]
    for grade in chosen_wf["weeks"]:
        history.setdefault("weeks", {})[str(grade["week"])] = {
            "season": grade["season"],
            "n": grade["n"],
            "hits": grade["hits"],
            "hit_rate": grade["hit_rate"],
            "graded_at": now.isoformat(),
        }
    history["updated_at"] = now.isoformat()
    dump(history_path, history)

    dump(out / "prop-params.json", chosen)

    cur = current_week(weeks)
    if cur is not None:
        snap_props = build_week_props(
            players,
            cur,
            chosen["best_props_min_rate"],
            chosen["best_props_alt_rate"],
        )
        # Strip bulky fields already implied
        slim = [
            {
                "slug": p["slug"],
                "name": p["name"],
                "team": p["team"],
                "role": p["role"],
                "stat": p["stat"],
                "thr": p["thr"],
                "rate": round(p["rate"], 4),
                "score": round(p["score"], 2),
            }
            for p in snap_props
        ]
        for p in slim:
            if p["stat"] in FORBIDDEN_PROPS:
                raise SystemExit(f"snapshot contains forbidden prop {p['stat']}")
        snap = {
            "season": cur["season"],
            "week": cur["week"],
            "built_at": now.isoformat(),
            "params": {
                "best_props_min_rate": chosen["best_props_min_rate"],
                "best_props_alt_rate": chosen["best_props_alt_rate"],
            },
            "props": slim,
        }
        dump(out / "snapshots" / f"week-{cur['week']}-best-props.json", snap)
        print(f"snapshot week {cur['week']}: {len(slim)} props")

    summary = {
        "improved": improved,
        "hit_rate": chosen_wf["hit_rate"],
        "n": chosen_wf["n"],
        "params": {
            "best_props_min_rate": chosen["best_props_min_rate"],
            "best_props_alt_rate": chosen["best_props_alt_rate"],
        },
    }
    dump(out / "improve-summary.json", summary)
    print(f"wrote {out / 'prop-params.json'} and accuracy history")


if __name__ == "__main__":
    main()
