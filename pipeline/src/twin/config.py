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

# Understat key -> (display name, FBref "Comp", StatsBomb competition id)
LEAGUES = {
    "EPL": ("Premier League", "Premier League", 2),
    "La_liga": ("La Liga", "La Liga", 11),
    "Bundesliga": ("Bundesliga", "Bundesliga", 9),
    "Serie_A": ("Serie A", "Serie A", 12),
    "Ligue_1": ("Ligue 1", "Ligue 1", 7),
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
        Metric("dribbles", "Successful dribbles", "FBref / StatsBomb", 1),
        Metric("dribble_pct", "Dribble success %", "FBref / StatsBomb", 0),
        Metric("final_third", "Final-third passes", "FBref / StatsBomb", 1),
        Metric("fouls_won", "Fouls won", "FBref / StatsBomb", 0),
    ]
}

# Metrics that are rates rather than counts (not divided by minutes / 90).
RATE_METRICS = {"xg_per_shot", "dribble_pct"}


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
            "The reel's 13 metrics. 2015/16 and 2017/18–2023/24 (2016/17 has no open "
            "dribble / final-third data).",
            CORE_METRICS,
            tuple(range(2015, 2024)),
            "understat",
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
