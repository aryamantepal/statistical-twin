"""Player positions: normalise each source's labels and group seasons for within-position scoring.

Codes: "GK", "DF", "MF", "FW" for a single role; "DF/MF", "MF/FW", ... for seasons spent in
several outfield roles (Understat gives the set of roles played, in no order); "" when the
source gives no outfield role.
"""

import numpy as np
import pandas as pd

from twin.model import zscore

GK = "GK"
OTHER = "other"
# Position groups smaller than this are pooled into OTHER for within-position z-scores.
MIN_GROUP = 200

_UNDERSTAT = {"D": "DF", "M": "MF", "F": "FW"}
_ORDER = {"DF": 0, "MF": 1, "FW": 2}


def from_understat(raw: str | None) -> str:
    """Understat `position`: space-separated roles played that season, e.g. "F M S".

    "GK" marks a goalkeeper; "S" only says the player came on as a substitute and is ignored.
    """
    tokens = (raw or "").split()
    if GK in tokens:
        return GK
    roles = sorted({_UNDERSTAT[t] for t in tokens if t in _UNDERSTAT}, key=_ORDER.get)
    return "/".join(roles)


def from_fbref(raw: str | None) -> str:
    """FBref `Pos`: comma-separated with the primary role first, e.g. "FW,MF" -> "FW"."""
    first = (raw or "").split(",")[0].strip()
    return first if first in {GK, *_ORDER} else ""


def groups(pos: pd.Series, min_size: int = MIN_GROUP) -> pd.Series:
    """The group each row is standardised within; unknown and tiny groups share OTHER."""
    counts = pos.value_counts()
    keep = set(counts.index[counts >= min_size]) - {""}
    return pos.where(pos.isin(keep), OTHER)


def zscore_within(scores: np.ndarray, group: pd.Series) -> np.ndarray:
    """Standardise each column inside each group (mean 0, std 1 per group)."""
    out = np.empty_like(scores, dtype=float)
    for g in group.unique():
        mask = (group == g).to_numpy()
        out[mask] = zscore(scores[mask])[0]
    return out
