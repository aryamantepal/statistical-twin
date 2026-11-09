"""Snapshot metadata, source checksums, metric dictionary, and population audit."""

import hashlib
import json
from pathlib import Path

from twin.config import (
    CACHE_DIR,
    MIN_MINUTES,
    MODELS,
    OUT_DIR,
    ROOT,
)


def sha256_file(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def build_metric_dictionary() -> list[dict]:
    return [
        {
            "key": "npg",
            "label": "Non-penalty goals",
            "source": "Understat",
            "formula": "npg / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "npxg",
            "label": "npxG",
            "source": "Understat",
            "formula": "npxG / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "shots",
            "label": "Shots",
            "source": "Understat",
            "formula": "shots / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "xg_per_shot",
            "label": "xG per shot",
            "source": "Understat",
            "formula": "xG / shots",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "assists",
            "label": "Assists",
            "source": "Understat",
            "formula": "assists / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "xa",
            "label": "xA",
            "source": "Understat",
            "formula": "xA / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "key_passes",
            "label": "Key passes",
            "source": "Understat",
            "formula": "key_passes / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "xgchain",
            "label": "Chance involvement (xGChain)",
            "source": "Understat",
            "formula": "xGChain / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "xgbuildup",
            "label": "Build-up involvement (xGBuildup)",
            "source": "Understat",
            "formula": "xGBuildup / (minutes / 90)",
            "coverage": "2014/15-2025/26",
            "status": "Complete",
            "gap": None,
        },
        {
            "key": "dribbles",
            "label": "Successful dribbles",
            "source": "FBref (2017/18-2023/24) / StatsBomb (2015/16)",
            "formula": "successful dribbles / (minutes / 90)",
            "coverage": "2015/16 (excl. Bundesliga), 2017/18-2023/24",
            "status": "Missing post-2023/24, 2016/17, and Bundesliga 2015/16",
            "gap": "Sofascore closed API; FBref mirror frozen Oct 2024; StatsBomb covers only 2015/16.",
        },
        {
            "key": "dribble_pct",
            "label": "Dribble success %",
            "source": "FBref (2017/18-2023/24) / StatsBomb (2015/16)",
            "formula": "(successful dribbles / attempted dribbles) * 100",
            "coverage": "2015/16 (excl. Bundesliga), 2017/18-2023/24",
            "status": "Missing post-2023/24, 2016/17, and Bundesliga 2015/16",
            "gap": "Sofascore closed API; FBref mirror frozen Oct 2024; StatsBomb covers only 2015/16.",
        },
        {
            "key": "final_third",
            "label": "Final-third passes",
            "source": "FBref (2017/18-2023/24) / StatsBomb (2015/16)",
            "formula": "completed passes into final third / (minutes / 90)",
            "coverage": "2015/16 (excl. Bundesliga), 2017/18-2023/24",
            "status": "Missing post-2023/24, 2016/17, and Bundesliga 2015/16",
            "gap": "Sofascore closed API; FBref mirror frozen Oct 2024; StatsBomb covers only 2015/16. Reel definition is passes within final third.",
        },
        {
            "key": "fouls_won",
            "label": "Fouls won",
            "source": "FBref (2017/18-2023/24) / StatsBomb (2015/16)",
            "formula": "fouls won / (minutes / 90)",
            "coverage": "2015/16 (excl. Bundesliga), 2017/18-2023/24",
            "status": "Missing post-2023/24, 2016/17, and Bundesliga 2015/16",
            "gap": "Sofascore closed API; FBref mirror frozen Oct 2024; StatsBomb covers only 2015/16.",
        },
    ]


def build_snapshot() -> dict:
    fbref_tables = ["standard", "shooting", "possession", "passing", "misc"]
    fbref_hashes = {}
    for table in fbref_tables:
        p = CACHE_DIR / "fbref" / f"big5_player_{table}.rds"
        fbref_hashes[table] = {
            "path": str(p.relative_to(ROOT)) if p.exists() else None,
            "sha256": sha256_file(p),
        }

    understat_leagues = ["EPL", "La_liga", "Bundesliga", "Serie_A", "Ligue_1"]
    understat_2025_hashes = {}
    for lg in understat_leagues:
        p = CACHE_DIR / "understat" / f"{lg}_2025.json"
        understat_2025_hashes[lg] = {
            "path": str(p.relative_to(ROOT)) if p.exists() else None,
            "sha256": sha256_file(p),
        }

    sb_matches_dir = CACHE_DIR / "statsbomb" / "matches"
    sb_cached_matches = len(list(sb_matches_dir.glob("*.json"))) if sb_matches_dir.exists() else 0

    return {
        "as_of": "2026-11-08",
        "minutes_threshold": MIN_MINUTES,
        "sources": {
            "fbref_rds": fbref_hashes,
            "understat_2025": understat_2025_hashes,
            "statsbomb": {
                "matches_dir": str(sb_matches_dir.relative_to(ROOT))
                if sb_matches_dir.exists()
                else None,
                "cached_match_count": sb_cached_matches,
            },
        },
        "metric_dictionary": build_metric_dictionary(),
        "population_audit": {
            "reel_main_universe": 11313,
            "reel_extended_universe": 17202,
            "understat_10_seasons_2015_2024": 11340,
            "understat_all_seasons_2014_2025": 13588,
            "fbref_15_seasons_2009_2023": 17193,
            "core_model_seasons": 8903,
            "explanations": {
                "main_universe": "11,313 matches 10 big-five seasons (2015/16 through 2024/25); Understat has 11,340 player-seasons with >=1,500 min.",
                "extended_universe": "17,202 matches 15 big-five seasons (2009/10 through 2023/24); FBref has 17,193 player-seasons with >=1,500 min.",
            },
        },
        "models": {
            k: {
                "key": m.key,
                "label": m.label,
                "description": m.description,
                "metric_count": len(m.metrics),
                "metrics": list(m.metrics),
                "season_count": len(m.seasons),
                "base": m.base,
            }
            for k, m in MODELS.items()
        },
        "audit_results": {
            "subject": "Lamine Yamal 2025/26",
            "subject_profile": {
                "age": 18,
                "minutes": 2291,
                "dribbles_completed": 133,
                "dribbles_attempted": 243,
                "dribble_success_pct": 54.7,
            },
            "understat_normal": {
                "yamal_top_twins": [
                    {"rank": 1, "player": "Lionel Messi", "season": "2022/23", "distance": 0.62},
                    {"rank": 2, "player": "Michael Olise", "season": "2025/26", "distance": 0.69},
                    {"rank": 3, "player": "Riyad Mahrez", "season": "2019/20", "distance": 0.92},
                    {"rank": 4, "player": "Arjen Robben", "season": "2014/15", "distance": 1.08},
                    {"rank": 5, "player": "Lionel Messi", "season": "2019/20", "distance": 1.10},
                    {"rank": 7, "player": "Josip Iličić", "season": "2018/19", "distance": 1.16},
                    {"rank": 9, "player": "Michael Olise", "season": "2024/25", "distance": 1.19},
                    {"rank": 11, "player": "Lionel Messi", "season": "2015/16", "distance": 1.25},
                    {"rank": 13, "player": "Neymar", "season": "2016/17", "distance": 1.34},
                    {"rank": 24, "player": "Leroy Sané", "season": "2023/24", "distance": 1.58},
                ],
                "messi_15_16_twins": [
                    {"rank": 9, "player": "Lamine Yamal", "season": "2025/26", "distance": 1.25},
                    {"rank": 13, "player": "Kylian Mbappé", "season": "2021/22", "distance": 1.28},
                ],
            },
            "understat_linear": {
                "yamal_top_twins": [
                    {"rank": 1, "player": "Lionel Messi", "season": "2022/23", "distance": 0.14},
                    {"rank": 2, "player": "Lionel Messi", "season": "2019/20", "distance": 0.15},
                    {"rank": 3, "player": "Arjen Robben", "season": "2014/15", "distance": 0.16},
                    {"rank": 4, "player": "Josip Iličić", "season": "2018/19", "distance": 0.17},
                    {"rank": 5, "player": "Lionel Messi", "season": "2020/21", "distance": 0.21},
                    {"rank": 14, "player": "Neymar", "season": "2016/17", "distance": 0.36},
                    {"rank": 16, "player": "Leroy Sané", "season": "2023/24", "distance": 0.38},
                    {"rank": 54, "player": "Lionel Messi", "season": "2015/16", "distance": 0.64},
                ],
                "messi_15_16_twins": [
                    {"rank": 11, "player": "Kylian Mbappé", "season": "2021/22", "distance": 0.31},
                    {"rank": 60, "player": "Lamine Yamal", "season": "2025/26", "distance": 0.64},
                ],
            },
        },
    }


def export_snapshot(target: Path | None = None) -> dict:
    snapshot = build_snapshot()
    serialized = json.dumps(snapshot, indent=2)

    data_dir = ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "snapshot.json").write_text(serialized)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "snapshot.json").write_text(serialized)

    if target:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(serialized)

    return snapshot
