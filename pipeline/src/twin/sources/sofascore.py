"""Sofascore season totals for dribbles, fouls won and final-third passes.

Reads only the local cache written by `scripts/fetch_sofascore.py`; the build never touches
the network for Sofascore. Sofascore has no detailed player stats before 2015/16.
"""

import json
import re

import pandas as pd

from twin.config import CACHE_DIR

DIR = CACHE_DIR / "sofascore"
FIELDS = {
    "totalContest": "dribbles_att_total",
    "successfulDribbles": "dribbles_total",
    "wasFouled": "fouls_won_total",
    "accurateFinalThirdPasses": "final_third_total",
}
PAGE = re.compile(r"(?P<league>\w+?)_(?P<season>\d{4})_p\d+\.json")


def load(seasons) -> pd.DataFrame:
    rows = []
    for path in sorted(DIR.glob("*_p*.json")):
        m = PAGE.fullmatch(path.name)
        if not m or int(m["season"]) not in set(seasons):
            continue
        for r in json.loads(path.read_text()).get("results", []):
            rows.append(
                {
                    "sofascore_id": r["player"]["id"],
                    "player": r["player"]["name"],
                    "team": r.get("team", {}).get("name", ""),
                    "minutes": r.get("minutesPlayed") or 0,
                    "league": m["league"],
                    "season": int(m["season"]),
                    **{v: r.get(k) for k, v in FIELDS.items()},
                }
            )
    if not rows:
        raise FileNotFoundError(
            f"no Sofascore cache in {DIR}; restore it with `uv run twin sync pull`, or "
            "download it once with `uv run --with curl_cffi python scripts/fetch_sofascore.py`"
        )
    df = pd.DataFrame(rows).drop_duplicates(["sofascore_id", "league", "season"])
    cols = list(FIELDS.values())
    # A league-season with no stats at all (2014/15) is absent, not zero.
    has = df.groupby(["league", "season"])[cols].transform(lambda s: s.notna().any())
    df = df[has.all(axis=1)].copy()
    df[cols] = df[cols].fillna(0)
    return df.reset_index(drop=True)
