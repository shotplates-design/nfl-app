#!/usr/bin/env python3
"""Merge Kenzie’s local conditions feed into data/week-N-conditions.json.

Kenzie’s drop lives outside the git repo (default: /workspace/feeds/week-N-
conditions.json). GitHub Actions cannot see that path; this script is for the
box (or any host that mounts the feed). Fail closed on missing/empty/broken
input. Kenzie’s injury rows win on (team, player); other game fields she
sends (weather, with_without, kickoff_et, inactives) also win when present.
Field names stay exactly as Best Props / Sleepers / matchups already read.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ET = ZoneInfo("America/New_York")
DEFAULT_FEEDS = Path("/workspace/feeds")

# Reuse the same fail-closed gates as refresh_injuries where practical.
MIN_TOTAL_INJURIES = 20


class FailClosed(RuntimeError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FailClosed(f"Kenzie feed not found: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise FailClosed(f"Cannot parse {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise FailClosed(f"{path} root must be an object")
    return data


def validate_kenzie(data: dict[str, Any], path: Path) -> None:
    week = data.get("week")
    if not isinstance(week, int) or week < 1:
        raise FailClosed(f"{path}: week must be a positive int")
    games = data.get("games")
    if not isinstance(games, list) or not games:
        raise FailClosed(f"{path}: games must be a non-empty list")
    total = 0
    for i, game in enumerate(games):
        if not isinstance(game, dict):
            raise FailClosed(f"{path}: games[{i}] is not an object")
        for key in ("away", "home", "injuries"):
            if key not in game:
                raise FailClosed(f"{path}: games[{i}] missing {key}")
        injuries = game["injuries"]
        if not isinstance(injuries, list):
            raise FailClosed(f"{path}: games[{i}].injuries must be a list")
        if len(injuries) == 0 and len(games) >= 8:
            # Allow a bye-less slate to have one quiet game, but not a blank feed.
            pass
        for j, row in enumerate(injuries):
            if not isinstance(row, dict) or not row.get("player") or not row.get("team"):
                raise FailClosed(f"{path}: games[{i}].injuries[{j}] needs team+player")
            for bad in ("odds", "spread", "moneyline", "sportsbook", "parlay"):
                if bad in row:
                    raise FailClosed(f"{path}: forbidden key {bad} in injury row")
            total += 1
    if total < MIN_TOTAL_INJURIES:
        raise FailClosed(f"{path}: only {total} injuries (need >= {MIN_TOTAL_INJURIES})")


def injury_key(row: dict[str, Any]) -> tuple[str, str]:
    return (str(row.get("team") or "").strip().upper(), str(row.get("player") or "").strip().lower())


def merge_game(base: dict[str, Any] | None, kenzie: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base) if base else {
        "away": kenzie["away"],
        "home": kenzie["home"],
        "weather": kenzie.get("weather") or {
            "indoor": False, "temp_f": None, "wind_mph": None,
            "precip_pct": None, "impact": "none",
            "note": "Seeded from Kenzie feed.",
        },
        "injuries": [],
        "with_without": [],
    }
    out["away"] = kenzie.get("away") or out.get("away")
    out["home"] = kenzie.get("home") or out.get("home")
    # Kenzie wins on these when she provides them.
    for key in ("weather", "with_without", "kickoff_et", "inactives", "inactives_note", "inactives_posted"):
        if key in kenzie and kenzie[key] is not None:
            out[key] = copy.deepcopy(kenzie[key])
    if "weather" not in out:
        out["weather"] = {
            "indoor": False, "temp_f": None, "wind_mph": None,
            "precip_pct": None, "impact": "none", "note": "",
        }
    if "with_without" not in out:
        out["with_without"] = []

    base_rows = list(out.get("injuries") or [])
    by_key = {injury_key(r): copy.deepcopy(r) for r in base_rows if r.get("player")}
    for row in kenzie.get("injuries") or []:
        by_key[injury_key(row)] = copy.deepcopy(row)  # Kenzie wins
    # Prefer Kenzie order, then any leftover base-only rows.
    ordered: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in kenzie.get("injuries") or []:
        k = injury_key(row)
        ordered.append(by_key[k])
        seen.add(k)
    for row in base_rows:
        k = injury_key(row)
        if k not in seen:
            ordered.append(by_key[k])
            seen.add(k)
    out["injuries"] = ordered
    return out


def merge_feeds(site: dict[str, Any] | None, kenzie: dict[str, Any]) -> dict[str, Any]:
    week = int(kenzie["week"])
    site_games = {(str(g.get("away") or "").upper(), str(g.get("home") or "").upper()): g
                  for g in (site or {}).get("games") or [] if isinstance(g, dict)}
    games = []
    for kg in kenzie["games"]:
        key = (str(kg.get("away") or "").upper(), str(kg.get("home") or "").upper())
        games.append(merge_game(site_games.get(key), kg))
    # Keep site-only games (e.g. if Kenzie omitted one) after hers.
    kenzie_keys = {(str(g.get("away") or "").upper(), str(g.get("home") or "").upper()) for g in kenzie["games"]}
    for key, sg in site_games.items():
        if key not in kenzie_keys:
            games.append(copy.deepcopy(sg))
    updated = dt.datetime.now(ET).replace(microsecond=0).isoformat()
    out: dict[str, Any] = {
        "week": week,
        "updated": updated,
        "games": games,
    }
    if kenzie.get("injury_source_note"):
        out["injury_source_note"] = kenzie["injury_source_note"]
    else:
        out["injury_source_note"] = (
            f"Merged Kenzie feed at {updated} via scripts/import_kenzie_feed.py. "
            "Kenzie injury rows win on team+player."
        )
    return out


def atomic_write(path: Path, data: dict[str, Any]) -> None:
    import tempfile
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=str(path.parent), delete=False) as tmp:
        tmp.write(text)
        tmp_path = Path(tmp.name)
    tmp_path.replace(path)


def git_commit_push(paths: list[Path], message: str, push: bool) -> None:
    rels = [str(p.relative_to(ROOT)) for p in paths]
    subprocess.run(["git", "add", *rels], cwd=ROOT, check=True)
    diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
    if diff.returncode == 0:
        print("No data changes to commit.")
        return
    subprocess.run(["git", "commit", "-m", message], cwd=ROOT, check=True)
    if push:
        subprocess.run(["git", "push"], cwd=ROOT, check=True)
        print("pushed")
    else:
        print("committed locally (no --push)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feeds-dir", type=Path, default=DEFAULT_FEEDS)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--week", type=int, help="Week number (default: highest week-*-conditions.json in feeds-dir)")
    parser.add_argument("--feed", type=Path, help="Explicit Kenzie feed path")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--commit", action="store_true", help="git add+commit the merged file")
    parser.add_argument("--push", action="store_true", help="with --commit, also git push")
    args = parser.parse_args(argv)

    try:
        if args.feed:
            feed_path = args.feed
        elif args.week:
            feed_path = args.feeds_dir / f"week-{args.week}-conditions.json"
        else:
            candidates = sorted(args.feeds_dir.glob("week-*-conditions.json"))
            # Ignore .prev backups already excluded by the pattern.
            if not candidates:
                raise FailClosed(f"No week-*-conditions.json under {args.feeds_dir}")
            feed_path = candidates[-1]
        kenzie = load_json(feed_path)
        validate_kenzie(kenzie, feed_path)
        week = int(kenzie["week"])
        site_path = args.data_dir / f"week-{week}-conditions.json"
        site = load_json(site_path) if site_path.exists() else None
        if site is not None:
            # Soft-validate site file; a broken site file should not block a good Kenzie drop.
            if not isinstance(site.get("games"), list):
                site = None
        merged = merge_feeds(site, kenzie)
        validate_kenzie(merged, site_path)  # same shape gates
    except FailClosed as exc:
        print(f"FAIL CLOSED: {exc}", file=sys.stderr)
        return 1

    total = sum(len(g.get("injuries") or []) for g in merged["games"])
    print(f"Kenzie {feed_path}: week {merged['week']}, {len(merged['games'])} games, {total} injuries (Kenzie wins)")
    if args.dry_run:
        print("dry-run: no write")
        return 0
    atomic_write(site_path, merged)
    print(f"wrote {site_path}")
    if args.commit:
        git_commit_push([site_path], f"Import Kenzie week {merged['week']} injury conditions", push=args.push)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
