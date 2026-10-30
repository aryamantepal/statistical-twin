import numpy as np
import pandas as pd
import pytest
from scipy.stats import norm

from twin.features import derive, normal_scores, per90, percentiles


def test_per90():
    assert per90([9, 0], [810, 90]).tolist() == [1.0, 0.0]


def test_percentiles_rank_within_group():
    values = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0, 10.0, 20.0]})
    groups = pd.Series(["x", "x", "x", "x", "y", "y"])
    pct = percentiles(values, groups)["a"].tolist()
    assert pct == [25.0, 50.0, 75.0, 100.0, 50.0, 100.0]


def test_percentiles_ties_share_average_rank():
    values = pd.DataFrame({"a": [1.0, 1.0, 2.0, 3.0]})
    pct = percentiles(values, pd.Series([0, 0, 0, 0]))["a"].tolist()
    assert pct == [37.5, 37.5, 75.0, 100.0]


def test_normal_scores_are_probit_of_midpoint_rank():
    values = pd.DataFrame({"a": [5.0, 1.0, 3.0, 2.0]})
    z = normal_scores(values, pd.Series([0, 0, 0, 0]))["a"]
    expected = norm.ppf((np.array([4, 1, 3, 2]) - 0.5) / 4)
    assert np.allclose(z, expected)
    assert z.sum() == pytest.approx(0)


def test_derive_rates_and_zero_denominators():
    df = pd.DataFrame(
        {
            "minutes": [1800, 900],
            "npg_total": [10, 0],
            "xg_total": [3.0, 0.0],
            "shots_total": [30, 0],
            "dribbles_total": [20, 0],
            "dribbles_att_total": [40, 0],
        }
    )
    out = derive(df, ["npg", "xg_per_shot", "dribble_pct"])
    assert out["npg"].tolist() == [0.5, 0.0]
    assert out["xg_per_shot"].tolist() == [0.1, 0.0]
    assert out["dribble_pct"].tolist() == [50.0, 0.0]
