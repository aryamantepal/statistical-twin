"""Understat league-season player totals (2014/15 onward)."""

from pathlib import Path

import pandas as pd

from twin.config import LEAGUES
from twin.sources.http import cached_json

NUMERIC = [
    "time",
    "games",
    "goals",
    "npg",
    "xG",
    "npxG",
    "shots",
    "assists",
    "xA",
    "key_passes",
    "xGChain",
    "xGBuildup",
]


def fetch_league_season(league: str, season: int) -> pd.DataFrame:
    data = cached_json(
        f"https://understat.com/getLeagueData/{league}/{season}",
        Path("understat") / f"{league}_{season}.json",
        headers={"X-Requested-With": "XMLHttpRequest"},
        delay=1.0,
    )
    df = pd.DataFrame(data["players"])
    df[NUMERIC] = df[NUMERIC].apply(pd.to_numeric)
    df["league"] = league
    df["season"] = season
    return df


def load(seasons) -> pd.DataFrame:
    frames = [fetch_league_season(lg, s) for s in seasons for lg in LEAGUES]
    df = pd.concat(frames, ignore_index=True)
    return df.rename(
        columns={
            "id": "player_id",
            "player_name": "player",
            "team_title": "team",
            "time": "minutes",
            "npxG": "npxg_total",
            "xG": "xg_total",
            "xA": "xa_total",
            "xGChain": "xgchain_total",
            "xGBuildup": "xgbuildup_total",
            "npg": "npg_total",
            "shots": "shots_total",
            "assists": "assists_total",
            "key_passes": "key_passes_total",
        }
    )
