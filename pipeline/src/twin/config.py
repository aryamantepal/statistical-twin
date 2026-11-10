"""Leagues, metrics and model definitions shared by every pipeline stage."""

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CACHE_DIR = ROOT / "data" / "cache"
OUT_DIR = ROOT / "web" / "public" / "data"

MIN_MINUTES = 1500
ISOLATION_RADIUS = 3.5
TOP_N = 25
# How percentiles become z-scores: "normal" = Φ⁻¹(percentile), then standardised;
# "linear" = standardise the 0–100 percentile directly. See README for why "normal".
ZSCORE = os.environ.get("TWIN_ZSCORE", "normal")

# Understat key -> (display name, FBref "Comp")
LEAGUES = {
    "EPL": ("Premier League", "Premier League"),
    "La_liga": ("La Liga", "La Liga"),
    "Bundesliga": ("Bundesliga", "Bundesliga"),
    "Serie_A": ("Serie A", "Serie A"),
    "Ligue_1": ("Ligue 1", "Ligue 1"),
}


def season_label(start_year: int) -> str:
    """2023 -> '2023/24'."""
    return f"{start_year}/{(start_year + 1) % 100:02d}"


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    source: str
    # Metrics on the "creator" side of the map's x axis get +1, "finisher" side -1, neutral 0.
    axis: int = 0


METRICS: dict[str, Metric] = {
    m.key: m
    for m in [
        Metric("npg", "Non-penalty goals", "Understat", -1),
        Metric("npxg", "npxG", "Understat", -1),
        Metric("shots", "Shots", "Understat", -1),
        Metric("sot", "Shots on target", "FBref", -1),
        Metric("xg_per_shot", "xG per shot", "Understat", -1),
        Metric("assists", "Assists", "Understat", 1),
        Metric("xa", "xA", "Understat", 1),
        Metric("key_passes", "Key passes", "Understat", 1),
        Metric("xgchain", "Chance involvement (xGChain)", "Understat", 0),
        Metric("xgbuildup", "Build-up involvement (xGBuildup)", "Understat", 1),
        Metric("dribbles", "Successful dribbles", "Sofascore", 1),
        Metric("dribble_pct", "Dribble success %", "Sofascore", 0),
        Metric("final_third", "Final-third passes", "Sofascore", 1),
        Metric("fouls_won", "Fouls won", "Sofascore", 0),
    ]
}

# Metrics that are rates rather than counts (not divided by minutes / 90).
RATE_METRICS = {"xg_per_shot", "dribble_pct"}
# xG-based metrics with no Champions League source: CL models keep them league-only.
LEAGUE_ONLY = {"npxg", "xa", "xg_per_shot", "xgchain", "xgbuildup"}
# CL models consider Understat seasons from this many league minutes, since league + CL
# minutes decide who reaches MIN_MINUTES.
UCL_FLOOR = 600


@dataclass(frozen=True)
class Model:
    key: str
    label: str
    description: str
    metrics: tuple[str, ...]
    # Season start years to include; seasons lacking any metric are dropped automatically.
    seasons: tuple[int, ...]
    # Which identity system rows come from: "understat" or "fbref".
    base: str
    # Add Champions League matches to the count stats and minutes.
    ucl: bool = False
    # Shown as a League / League + CL switch on this model's tab instead of as its own tab.
    variant_of: str | None = None


CORE_METRICS = (
    "npg",
    "npxg",
    "shots",
    "xg_per_shot",
    "assists",
    "xa",
    "key_passes",
    "xgchain",
    "xgbuildup",
    "dribbles",
    "dribble_pct",
    "final_third",
    "fouls_won",
)
UNDERSTAT_METRICS = CORE_METRICS[:9]
EXTENDED_METRICS = ("npg", "sot", "assists")

MODELS: dict[str, Model] = {
    m.key: m
    for m in [
        Model(
            "core",
            "13 metrics",
            "The reel's 13 metrics, 2015/16 onward (Sofascore has no detailed player stats "
            "before 2015/16).",
            CORE_METRICS,
            tuple(range(2015, 2026)),
            "understat",
        ),
        Model(
            "core_cl",
            "13 metrics",
            "League and Champions League matches, 2015/16 onward. npxG, xA, xG per shot, xGChain "
            "and xGBuildup stay league-only: Understat has no Champions League data.",
            CORE_METRICS,
            tuple(range(2015, 2026)),
            "understat",
            ucl=True,
            variant_of="core",
        ),
        Model(
            "understat",
            "Understat only",
            "The 9 Understat metrics, every season Understat covers (2014/15 onward).",
            UNDERSTAT_METRICS,
            tuple(range(2014, 2026)),
            "understat",
        ),
        Model(
            "extended",
            "Since 2009",
            "The only per-90 stats FBref carries back to 2009/10: non-penalty goals, "
            "shots on target and assists. Coarse by necessity.",
            EXTENDED_METRICS,
            tuple(range(2009, 2024)),
            "fbref",
        ),
    ]
}
