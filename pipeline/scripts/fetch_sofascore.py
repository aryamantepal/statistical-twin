"""One-off, throttled download of Sofascore season totals into data/cache/sofascore/.

Run manually, never in CI:  uv run --with curl_cffi python pipeline/scripts/fetch_sofascore.py
Every response is cached on disk and never requested twice; the run is resumable and stops on
the first non-200 response instead of retrying.
"""

import json
import sys
import time
from pathlib import Path

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "sofascore"
BASE = "https://www.sofascore.com/api/v1"
DELAY = 2.5
PAGE = 100
STOP_BELOW_MINUTES = 1200
FIELDS = "successfulDribbles,totalContest,wasFouled,accurateFinalThirdPasses,minutesPlayed"
# Understat league key -> Sofascore unique-tournament id
TOURNAMENTS = {"EPL": 17, "La_liga": 8, "Bundesliga": 35, "Serie_A": 23, "Ligue_1": 34}
SEASONS = range(2014, 2026)

session = requests.Session(impersonate="chrome")
last_request = 0.0
requests_made = 0


def get(path: Path, url: str) -> dict:
    global last_request, requests_made
    if path.exists():
        return json.loads(path.read_text())
    wait = DELAY - (time.monotonic() - last_request)
    if wait > 0:
        time.sleep(wait)
    r = session.get(url, timeout=30)
    last_request = time.monotonic()
    requests_made += 1
    if r.status_code != 200:
        sys.exit(f"stopping: HTTP {r.status_code} for {url}\n{r.text[:300]}")
    tmp = path.with_suffix(".tmp")
    tmp.write_text(r.text)
    tmp.rename(path)
    return r.json()


def season_ids(league: str, tid: int) -> dict[int, int]:
    data = get(CACHE / f"seasons_{league}.json", f"{BASE}/unique-tournament/{tid}/seasons")
    out = {}
    for s in data["seasons"]:
        a, _, b = s["year"].partition("/")
        if len(a) == 2 and len(b) == 2:
            out[2000 + int(a)] = s["id"]
    return out


def fetch(league: str, tid: int, year: int, sid: int) -> str:
    page = 0
    while True:
        url = (
            f"{BASE}/unique-tournament/{tid}/season/{sid}/statistics?limit={PAGE}"
            f"&offset={page * PAGE}&order=-minutesPlayed&accumulation=total&fields={FIELDS}"
        )
        data = get(CACHE / f"{league}_{year}_p{page}.json", url)
        rows = data.get("results", [])
        if page == 0 and rows and "totalContest" not in rows[0]:
            sys.exit(f"stopping: totalContest missing from {league} {year} rows")
        page += 1
        if not rows or page >= data.get("pages", 0):
            break
        if rows[-1].get("minutesPlayed", 0) < STOP_BELOW_MINUTES:
            break
    n = sum(
        len(json.loads((CACHE / f"{league}_{year}_p{p}.json").read_text()).get("results", []))
        for p in range(page)
    )
    return f"{page} page(s), {n} rows"


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for league, tid in TOURNAMENTS.items():
        ids = season_ids(league, tid)
        for year in SEASONS:
            if year not in ids:
                print(f"{league} {year}: no Sofascore season", flush=True)
                continue
            print(f"{league} {year}: {fetch(league, tid, year, ids[year])}", flush=True)
    print(f"done; {requests_made} network requests this run")


if __name__ == "__main__":
    main()
