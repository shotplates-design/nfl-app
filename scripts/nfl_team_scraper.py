"""
NFL.com team statistics scraper.

Manual only. CI must not call this. The scheduled refresh builds the same
all_team_stats.json shape from nflverse (then ESPN public JSON) via
scripts/build_team_stats.py. Pass --manual to hit NFL.com HTML.

Outputs:
  nfl_data/
    offense_passing.csv
    offense_rushing.csv
    ...
    all_team_stats.csv
    all_team_stats.json
    scrape_report.csv

Usage:
  python nfl_team_scraper.py
  python nfl_team_scraper.py --season 2025
  python nfl_team_scraper.py --season 2026 --type reg
  python nfl_team_scraper.py --type post
"""

import argparse
import json
import logging
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BASE_URL = "https://www.nfl.com/stats/team-stats"

# Categories are configurable. Some categories may be unavailable
# for a given season or season type.
CATEGORIES = {
    "offense": [
        "passing",
        "rushing",
        "receiving",
        "scoring",
        "downs",
        "fumbles",
    ],
    "defense": [
        "passing",
        "rushing",
        "receiving",
        "scoring",
        "tackles",
        "downs",
        "fumbles",
        "interceptions",
    ],
    "special-teams": [
        "scoring",
        "field-goals",
        "kickoffs",
        "kickoff-returns",
        "punt-returns",
        "punting",
    ],
}

OUTPUT_DIR = Path("nfl_data")
REQUEST_DELAY = 1.0
TIMEOUT = 25

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


def make_session():
    """Create a polite HTTP session with retry handling."""
    session = requests.Session()

    retries = Retry(
        total=3,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )

    session.mount(
        "https://",
        HTTPAdapter(max_retries=retries),
    )

    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    })

    return session


def build_url(unit, category, season, season_type):
    return (
        f"{BASE_URL}/{unit}/{category}/"
        f"{season}/{season_type}/all"
    )


def get_html(session, url, use_browser=False):
    """Fetch HTML with requests, optionally falling back to Chromium."""
    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()

    html = response.text
    soup = BeautifulSoup(html, "lxml")

    if soup.find("table") or soup.select_one(
        '[role="table"], [role="grid"]'
    ):
        return html

    if not use_browser:
        return html

    # Import only when browser rendering is actually needed.
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)

        try:
            page.locator("table").first.wait_for(timeout=12000)
        except Exception:
            # Some pages may not contain a table; still inspect the DOM.
            page.wait_for_timeout(2500)

        html = page.content()
        browser.close()

    return html


def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()


def parse_tables(html):
    """
    Parse all HTML tables into dataframes.

    Multi-row table headers are flattened. No individual stat columns
    are hardcoded, so additional columns are retained automatically.
    """
    soup = BeautifulSoup(html, "lxml")
    results = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue

        header_rows = []
        body_rows = []
        found_body = False

        for tr in rows:
            cells = tr.find_all(["th", "td"], recursive=False)
            if not cells:
                continue

            has_th = any(cell.name == "th" for cell in cells)

            if not found_body and has_th:
                header_rows.append(cells)
            else:
                found_body = True
                body_rows.append(cells)

        if not body_rows:
            continue

        # Flatten headers such as grouped or multi-level headings.
        width = max(
            [len(row) for row in header_rows + body_rows],
            default=0,
        )

        headers = []
        for col_index in range(width):
            parts = []

            for row in header_rows:
                if col_index < len(row):
                    label = clean_text(row[col_index].get_text(" ", strip=True))
                    if label and (not parts or label != parts[-1]):
                        parts.append(label)

            headers.append(" ".join(parts) or f"column_{col_index + 1}")

        # Use the first data row as a fallback if the page lacks headers.
        if not header_rows:
            headers = [
                f"column_{i + 1}" for i in range(width)
            ]

        # Ensure column names are unique.
        seen = {}
        unique_headers = []

        for header in headers:
            base = header
            seen[base] = seen.get(base, 0) + 1
            unique_headers.append(
                base if seen[base] == 1
                else f"{base}_{seen[base]}"
            )

        data = []

        for row in body_rows:
            cells = [
                clean_text(cell.get_text(" ", strip=True))
                for cell in row
            ]

            if not any(cells):
                continue

            # Skip rows that repeat the table header.
            if cells and cells[0].lower() in {
                "team", "player", "rank"
            }:
                continue

            # Pad or trim rows to match the column count.
            cells = (cells + [""] * width)[:width]
            data.append(cells)

        if data:
            df = pd.DataFrame(data, columns=unique_headers)
            df = df.dropna(how="all")
            if not df.empty:
                results.append(df)

    return results


def scrape_category(
    session, unit, category, season, season_type, use_browser
):
    url = build_url(unit, category, season, season_type)
    logging.info("Scraping %s / %s: %s", unit, category, url)

    time.sleep(REQUEST_DELAY)
    html = get_html(session, url, use_browser=use_browser)
    tables = parse_tables(html)

    if not tables:
        raise ValueError(
            "No HTML data table found. Page may be empty, "
            "blocked, or structured differently."
        )

    # NFL.com team-stat pages generally have one primary team table.
    # Choose the table with the most rows and columns.
    df = max(
        tables,
        key=lambda frame: frame.shape[0] * frame.shape[1],
    ).copy()

    # Preserve the original displayed values; don't coerce percentages
    # or strings like 82T into numbers.
    df.insert(0, "season", season)
    df.insert(1, "season_type", season_type)
    df.insert(2, "unit", unit)
    df.insert(3, "category", category)
    df["source_url"] = url

    return df


def scrape_all(season, season_type, use_browser=True):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    session = make_session()
    all_frames = []
    report = []

    for unit, categories in CATEGORIES.items():
        for category in categories:
            try:
                df = scrape_category(
                    session=session,
                    unit=unit,
                    category=category,
                    season=season,
                    season_type=season_type,
                    use_browser=use_browser,
                )

                filename = (
                    OUTPUT_DIR / f"{unit}_{category}.csv"
                )
                df.to_csv(filename, index=False, encoding="utf-8-sig")
                all_frames.append(df)

                report.append({
                    "unit": unit,
                    "category": category,
                    "status": "success",
                    "rows": len(df),
                    "columns": len(df.columns),
                    "file": str(filename),
                    "error": "",
                })

                logging.info(
                    "Saved %s rows to %s",
                    len(df), filename,
                )

            except Exception as exc:
                logging.exception(
                    "Failed: %s / %s", unit, category
                )

                report.append({
                    "unit": unit,
                    "category": category,
                    "status": "failed",
                    "rows": 0,
                    "columns": 0,
                    "file": "",
                    "error": str(exc),
                })

    if all_frames:
        combined = pd.concat(
            all_frames,
            ignore_index=True,
            sort=False,
        )

        combined.to_csv(
            OUTPUT_DIR / "all_team_stats.csv",
            index=False,
            encoding="utf-8-sig",
        )

        combined.to_json(
            OUTPUT_DIR / "all_team_stats.json",
            orient="records",
            indent=2,
            force_ascii=False,
        )

        logging.info(
            "Combined dataset: %s rows, %s columns",
            len(combined), len(combined.columns),
        )

    report_df = pd.DataFrame(report)
    report_df.to_csv(
        OUTPUT_DIR / "scrape_report.csv",
        index=False,
        encoding="utf-8-sig",
    )

    failures = report_df[
        report_df["status"] == "failed"
    ] if not report_df.empty else pd.DataFrame()

    print(f"\nFinished. Files saved in: {OUTPUT_DIR.resolve()}")
    print(f"Successful categories: {len(report) - len(failures)}")
    print(f"Failed categories: {len(failures)}")

    if not failures.empty:
        print("\nReview scrape_report.csv for errors.")
        print(failures[["unit", "category", "error"]].to_string(index=False))


def main():
    parser = argparse.ArgumentParser(
        description="Scrape NFL.com team statistics."
    )

    parser.add_argument(
        "--season",
        type=int,
        default=2026,
        help="NFL season year (default: 2026)",
    )

    parser.add_argument(
        "--type",
        dest="season_type",
        choices=["reg", "pre", "post"],
        default="reg",
        help="reg=regular, pre=preseason, post=postseason",
    )

    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Disable Playwright fallback",
    )

    parser.add_argument(
        "--manual",
        action="store_true",
        help="Actually request NFL.com HTML. Refused unless this flag is set.",
    )

    args = parser.parse_args()

    if not args.manual:
        raise SystemExit(
            "NFL.com HTML scraping is manual-only. "
            "CI uses scripts/build_team_stats.py (nflverse, then ESPN public JSON)."
        )

    scrape_all(
        season=args.season,
        season_type=args.season_type,
        use_browser=not args.no_browser,
    )


if __name__ == "__main__":
    main()