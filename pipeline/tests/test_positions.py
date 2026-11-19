import numpy as np
import pandas as pd

from twin import positions


def test_understat_roles():
    f = positions.from_understat
    assert f("GK") == "GK" and f("GK S") == "GK"
    assert f("D S") == "DF" and f("F M S") == "MF/FW" and f("D F M S") == "DF/MF/FW"
    # Only substitute appearances, or nothing at all, is unknown rather than a guess.
    assert f("S") == "" and f("") == "" and f(None) == ""


def test_fbref_primary_role():
    f = positions.from_fbref
    assert f("FW,MF") == "FW" and f("GK") == "GK" and f("DF,GK") == "DF"
    assert f("") == "" and f(None) == "" and f("??") == ""


def test_groups_pool_unknown_and_tiny():
    pos = pd.Series(["DF"] * 3 + ["MF"] * 3 + ["DF/FW", ""])
    assert positions.groups(pos, min_size=3).tolist() == ["DF"] * 3 + ["MF"] * 3 + ["other"] * 2


def test_zscore_within_standardises_each_group():
    scores = np.array([[0.0], [2.0], [10.0], [14.0]])
    z = positions.zscore_within(scores, pd.Series(["a", "a", "b", "b"]))
    assert np.allclose(z[:, 0], [-1, 1, -1, 1])
