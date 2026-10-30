"""Link the same player-season across sources that share no IDs.

Within each league-season we score every (left, right) pair on name similarity, minutes
agreement and team similarity, solve the assignment with the Hungarian algorithm, then keep
only pairs that clear an acceptance rule. Minutes are the strongest signal: two sources
counting the same player's season rarely disagree by more than a few percent.
"""

import re
import unicodedata

import numpy as np
import pandas as pd
from rapidfuzz import fuzz, process
from scipy.optimize import linear_sum_assignment

# Letters NFKD does not decompose to ASCII.
_TRANSLIT = str.maketrans({"ø": "o", "ß": "ss", "ł": "l", "đ": "d", "æ": "ae", "ı": "i", "œ": "oe"})


def normalize(name: str) -> str:
    name = unicodedata.normalize("NFKD", name.lower().translate(_TRANSLIT))
    name = "".join(c for c in name if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", name).split())


def accept(name: float, minutes: float, team: float) -> bool:
    return (
        name >= 88
        or (name >= 60 and minutes >= 0.5)
        or (name >= 40 and minutes >= 0.85 and team >= 0.6)
    )


def link(left: pd.DataFrame, right: pd.DataFrame, on: list[str]) -> pd.DataFrame:
    """Return (left_index, right_index, name, minutes, team) for accepted links.

    Both frames need `player`, `team` and `minutes` columns plus the `on` group columns.
    """
    out = []
    right_groups = dict(tuple(right.groupby(on)))
    for key, lg in left.groupby(on):
        rg = right_groups.get(key)
        if rg is None:
            continue
        lp, rp = [list(map(normalize, g["player"])) for g in (lg, rg)]
        lt, rt = [list(map(normalize, g["team"].astype(str))) for g in (lg, rg)]
        names = np.maximum(
            process.cdist(lp, rp, scorer=fuzz.token_set_ratio),
            process.cdist(lp, rp, scorer=fuzz.WRatio),
        )
        teams = process.cdist(lt, rt, scorer=fuzz.partial_ratio) / 100
        lm = lg["minutes"].to_numpy(float)[:, None]
        rm = rg["minutes"].to_numpy(float)[None, :]
        mins = np.clip(1 - np.abs(lm - rm) / np.maximum(150.0, 0.1 * np.maximum(lm, rm)), 0, 1)
        total = names + 40 * mins + 10 * teams
        rows, cols = linear_sum_assignment(-total)
        for i, j in zip(rows, cols):
            if accept(names[i, j], mins[i, j], teams[i, j]):
                out.append((lg.index[i], rg.index[j], names[i, j], mins[i, j], teams[i, j]))
    return pd.DataFrame(out, columns=["left", "right", "name", "minutes", "team"])
