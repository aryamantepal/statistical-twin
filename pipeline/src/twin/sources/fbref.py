"""FBref big-five season tables, via the pre-scraped worldfootballR_data GitHub release.

FBref itself sits behind a bot challenge, so we read the copies JaseZiv publishes as
GitHub release assets for the worldfootballR package (`load_fb_big5_advanced_season_stats`).
"""

from pathlib import Path

import pandas as pd
import pyreadr

from twin.config import CACHE_DIR
from twin.sources.http import cached_get

RELEASE = (
    "https://github.com/JaseZiv/worldfootballR_data/releases/download/fb_big5_advanced_season_stats"
)

# table -> {fbref column: our column}
TABLES = {
    "standard": {"Min_Playing": "minutes", "G_minus_PK": "npg_total", "Ast": "assists_total"},
    "shooting": {"SoT_Standard": "sot_total"},
    "possession": {"Att_Take": "dribbles_att_total", "Succ_Take": "dribbles_total"},
    "passing": {"Final_Third": "final_third_total"},
    "misc": {"Fld": "fouls_won_total"},
}


def _read_table(name: str) -> pd.DataFrame:
    rel = Path("fbref") / f"big5_player_{name}.rds"
    cached_get(f"{RELEASE}/big5_player_{name}.rds", rel)
    return pyreadr.read_r(CACHE_DIR / rel)[None]


def load() -> pd.DataFrame:
    """One row per (player url, competition, season end year), squads summed.

    A stat column is NaN for any season where the mirror lacks that table, so callers can
    tell "missing" from "zero".
    """
    # Key on FBref's player id: the URL slug after it differs between tables
    # (".../8f696594/Memphis" vs ".../8f696594/Memphis-Depay").
    keys = ["fbref_id", "Comp", "Season_End_Year"]
    merged = None
    for name, cols in TABLES.items():
        df = _read_table(name)
        df["fbref_id"] = df["Url"].str.extract(r"/players/([0-9a-f]+)/")[0]
        if name == "standard":
            df = df.groupby(keys, as_index=False).agg(
                player=("Player", "first"),
                squad=("Squad", lambda s: ",".join(dict.fromkeys(s))),
                **{v: (k, lambda s: s.sum(min_count=1)) for k, v in cols.items()},
            )
        else:
            df = df.groupby(keys, as_index=False)[list(cols)].sum(min_count=1).rename(columns=cols)
        merged = df if merged is None else merged.merge(df, on=keys, how="left")
    return merged.rename(columns={"Comp": "comp", "Season_End_Year": "season_end"})
