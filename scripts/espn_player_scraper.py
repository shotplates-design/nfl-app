"""Scrape each NFL player's career stats from ESPN (Playwright + pandas).

Manual only. CI must not launch Playwright or scrape espn.com HTML. The
scheduled refresh builds game logs from nflverse, then ESPN's public JSON
(site.web.api), via scripts/build_player_logs.py. Pass --manual to scrape.

Reads data/nfl_players.csv (made by the roster scraper), visits every player's
ESPN stats page, and saves one CSV per stat category (passing, rushing,
receiving, defensive, ...). Each row is one season for one player.

It is RESUMABLE: every player is appended to data/nfl_stats_raw.jsonl as soon
as it is scraped, so you can stop it (Ctrl+C) and run it again later and it
picks up where it left off.

Usage:
    python ingest/nfl_stats.py --limit 3 --headed     # test on 3 players first
    python ingest/nfl_stats.py                        # everyone (resumable)
    python ingest/nfl_stats.py --team kc              # one team only
    python ingest/nfl_stats.py --rebuild-only         # just rebuild the CSVs
    python ingest/nfl_stats.py --retry-empty          # re-try players that came back empty
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from io import StringIO
from pathlib import Path

import pandas as pd
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

STATS_URL = "https://www.espn.com/nfl/player/stats/_/id/{pid}"

# Runs inside the page: every stats block (with its title, e.g. "Passing")
# plus the raw HTML of its table(s).
EXTRACT_JS = """
() => {
  const groups = [];
  document.querySelectorAll('.ResponsiveTable').forEach(w => {
    const t = w.querySelector('.Table__Title');
    const tables = Array.from(w.querySelectorAll('table')).map(x => x.outerHTML);
    if (tables.length) groups.push({title: t ? t.innerText.trim() : null, tables});
  });
  if (!groups.length) {
    document.querySelectorAll('table').forEach(t =>
      groups.push({title: null, tables: [t.outerHTML]}));
  }
  return {groups};
}
"""


def slug(text: str | None, fallback: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    return s or fallback


def clean_col(c) -> str:
    if isinstance(c, tuple):
        c = c[-1]
    return re.sub(r"\s+", " ", str(c)).strip().lower()


def parse_group(tables: list[str]) -> pd.DataFrame | None:
    """One stats block -> DataFrame.

    ESPN often splits a block into a left table (Year, Team) and a right table
    (the stats) with the same number of rows; glue those side by side.
    """
    frames = []
    for html in tables:
        try:
            frames.append(pd.read_html(StringIO(html))[0])
        except ValueError:
            continue
    if not frames:
        return None
    if len(frames) > 1 and len({len(f) for f in frames}) == 1:
        df = pd.concat(frames, axis=1)
    else:
        df = max(frames, key=lambda f: f.shape[1])
    df = df.copy()
    df.columns = [clean_col(c) for c in df.columns]
    df = df.loc[:, ~pd.Index(df.columns).duplicated()]
    df = df.dropna(how="all")
    return df if len(df) else None


def frame_to_records(df: pd.DataFrame) -> list[dict]:
    df = df.astype(object).where(df.notna(), None)
    return df.to_dict("records")


def scrape_player(page, pid: str) -> list[tuple[str, list[dict]]] | None:
    """Returns [(category, rows), ...]; None if the page never showed a table."""
    url = STATS_URL.format(pid=pid)
    for attempt in range(1, 4):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            page.wait_for_selector("table", timeout=12_000)
        except PWTimeout:
            time.sleep(2 * attempt)
            continue
        data = page.evaluate(EXTRACT_JS)
        out = []
        for i, group in enumerate(data["groups"], 1):
            df = parse_group(group["tables"])
            if df is not None:
                out.append((slug(group["title"], f"table_{i}"), frame_to_records(df)))
        if out:
            return out
        time.sleep(2 * attempt)
    return None


def load_done(raw_path: Path, retry_empty: bool) -> set[str]:
    done: set[str] = set()
    if not raw_path.exists():
        return done
    with raw_path.open(encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("empty") and retry_empty:
                continue
            done.add(rec["player_id"])
    return done


def rebuild(raw_path: Path, out_dir: Path) -> None:
    if not raw_path.exists():
        print(f"Nothing to rebuild: {raw_path} does not exist.")
        return
    by_cat: dict[str, list[dict]] = {}
    with raw_path.open(encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("empty"):
                continue
            by_cat.setdefault(rec["category"], []).extend(rec["rows"])
    out_dir.mkdir(parents=True, exist_ok=True)
    for cat, rows in by_cat.items():
        df = pd.DataFrame(rows)
        lead = [c for c in ("player_id", "player_name", "current_team") if c in df.columns]
        df = df[lead + [c for c in df.columns if c not in lead]]
        path = out_dir / f"{cat}.csv"
        df.to_csv(path, index=False)
        print(f"  {path}: {len(df)} rows, {df['player_id'].nunique()} players")


def main() -> int:
    ap = argparse.ArgumentParser(description="Scrape NFL player stats from ESPN")
    ap.add_argument("--players", default="data/nfl_players.csv")
    ap.add_argument("--raw", default="data/nfl_stats_raw.jsonl")
    ap.add_argument("--out-dir", default="data/stats")
    ap.add_argument("--team", default=None, help="only this team code, e.g. kc")
    ap.add_argument("--limit", type=int, default=None, help="only the first N not-yet-done players")
    ap.add_argument("--delay", type=float, default=2.5, help="average seconds between players")
    ap.add_argument("--headed", action="store_true", help="show the browser window")
    ap.add_argument("--retry-empty", action="store_true")
    ap.add_argument("--rebuild-only", action="store_true")
    ap.add_argument("--manual", action="store_true", help="Actually open ESPN pages in Playwright.")
    args = ap.parse_args()

    raw_path, out_dir = Path(args.raw), Path(args.out_dir)
    if not args.manual and not args.rebuild_only:
        print("ESPN HTML scraping is manual-only. CI uses scripts/build_player_logs.py.")
        return 2
    if args.rebuild_only:
        rebuild(raw_path, out_dir)
        return 0

    players_path = Path(args.players)
    if not players_path.exists():
        print(f"Can't find {players_path}. Run the roster scraper first.")
        return 1
    players = pd.read_csv(players_path, dtype={"player_id": str})
    players = players[players["player_id"].notna()].drop_duplicates("player_id")
    if args.team:
        players = players[players["team_code"] == args.team.lower()]

    done = load_done(raw_path, args.retry_empty)
    todo = players[~players["player_id"].isin(done)]
    if args.limit:
        todo = todo.head(args.limit)
    print(f"{len(players)} players in scope, {len(done)} already done, {len(todo)} to scrape")
    if todo.empty:
        rebuild(raw_path, out_dir)
        return 0

    raw_path.parent.mkdir(parents=True, exist_ok=True)
    empty_count = 0
    try:
        with sync_playwright() as p, raw_path.open("a", encoding="utf-8") as raw:
            browser = p.chromium.launch(headless=not args.headed)
            page = browser.new_context(viewport={"width": 1400, "height": 900}).new_page()
            for i, row in enumerate(todo.itertuples(index=False), 1):
                pid, name, team = str(row.player_id), row.name, row.team_code
                result = scrape_player(page, pid)
                meta = {"player_id": pid, "player_name": name, "current_team": team}
                if result is None:
                    empty_count += 1
                    raw.write(json.dumps({**meta, "empty": True}) + "\n")
                    print(f"[{i}/{len(todo)}] {name} ({team}): no stats table")
                else:
                    for cat, rows in result:
                        rows = [{**meta, **r} for r in rows]
                        raw.write(json.dumps({**meta, "category": cat, "rows": rows}, default=str) + "\n")
                    n_rows = sum(len(r) for _, r in result)
                    print(f"[{i}/{len(todo)}] {name} ({team}): {len(result)} categories, {n_rows} rows")
                raw.flush()
                if i < len(todo):
                    time.sleep(args.delay * random.uniform(0.6, 1.4))
            browser.close()
    except KeyboardInterrupt:
        print("\nStopped. Progress is saved; run the same command again to resume.")

    print("\nBuilding CSVs...")
    rebuild(raw_path, out_dir)
    if empty_count:
        print(f"{empty_count} players returned no stats table (rookies/practice squad are normal). "
              "If MANY did, ESPN may be blocking you: slow down with --delay 5 and use --retry-empty.")
    return 0


if __name__ == "__main__":
    sys.exit(main())