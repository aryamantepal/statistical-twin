"""Per-90 rates and within-league-season percentiles."""

import numpy as np
import pandas as pd
from scipy.stats import norm

from twin.config import RATE_METRICS


def per90(total, minutes):
    return np.asarray(total, dtype=float) * 90.0 / np.asarray(minutes, dtype=float)


def safe_ratio(num, den):
    num, den = np.asarray(num, dtype=float), np.asarray(den, dtype=float)
    return np.divide(num, den, out=np.zeros_like(num), where=den > 0)


def derive(df: pd.DataFrame, metrics) -> pd.DataFrame:
    """Turn `<metric>_total` columns (plus minutes) into the model's metric columns."""
    out = pd.DataFrame(index=df.index)
    for key in metrics:
        if key == "xg_per_shot":
            out[key] = safe_ratio(df["xg_total"], df["shots_total"])
        elif key == "dribble_pct":
            out[key] = 100 * safe_ratio(df["dribbles_total"], df["dribbles_att_total"])
        else:
            assert key not in RATE_METRICS
            out[key] = per90(df[f"{key}_total"], df["minutes"])
    return out


def percentiles(values: pd.DataFrame, groups: pd.DataFrame | pd.Series) -> pd.DataFrame:
    """Percentile rank (0–100] of each value within its group; ties share the average rank.

    The best player in a group scores 100; the worst scores 100/n.
    """
    return values.groupby(groups).rank(method="average", pct=True) * 100


def normal_scores(values: pd.DataFrame, groups: pd.DataFrame | pd.Series) -> pd.DataFrame:
    """Rank-based normal scores within each group: Φ⁻¹((rank − ½) / n).

    This is the percentile re-expressed as a standard-normal z, so a 100th-percentile season
    sits ~2.7σ out rather than being capped at the uniform distribution's 1.73σ.
    """
    ranks = values.groupby(groups).rank(method="average")
    n = values.groupby(groups).transform("count")
    return pd.DataFrame(norm.ppf((ranks - 0.5) / n), index=values.index, columns=values.columns)
