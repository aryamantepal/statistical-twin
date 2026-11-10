import pandas as pd
import pytest

from twin import build
from twin.features import derive


def test_league_only_metrics_use_league_minutes_and_shots():
    df = pd.DataFrame(
        {
            "minutes": [1800],
            "league_minutes": [900],
            "npg_total": [10],
            "npxg_total": [4.5],
            "xg_total": [6.0],
            "shots_total": [40],
            "league_shots_total": [30],
        }
    )
    out = derive(df, ["npg", "npxg", "xg_per_shot", "shots"])
    assert out["npg"].item() == pytest.approx(0.5)  # 10 over league + CL minutes
    assert out["npxg"].item() == pytest.approx(0.45)  # league xG over league minutes
    assert out["xg_per_shot"].item() == pytest.approx(0.2)  # league xG over league shots
    assert out["shots"].item() == pytest.approx(2.0)


def test_add_ucl_sums_counts_and_credits_one_row_per_player(monkeypatch):
    cl = pd.DataFrame(
        {
            "sofascore_id": [1, 2],
            "season": [2024, 2024],
            "minutes": [600, 300],
            "goals_total": [3, 1],
            "penalty_goals_total": [1, 0],
            "shots_total": [10, 4],
            "assists_total": [2, 0],
            "key_passes_total": [8, 1],
            "dribbles_att_total": [20, 2],
            "dribbles_total": [10, 1],
            "final_third_total": [50, 5],
            "fouls_won_total": [6, 1],
        }
    )
    monkeypatch.setattr(build.sofascore, "load", lambda seasons, ucl=False: cl.copy())
    zeros = {c: [0, 0, 0, 0] for c in build.UCL_COUNTS}
    df = pd.DataFrame(
        {
            # Player 1 changed league mid-season: CL games go to the row with more minutes.
            "sofascore_id": [1, 1, 2, 3],
            "season": [2024, 2024, 2024, 2024],
            "minutes": [1000, 400, 1500, 2000],
            **zeros,
        }
    )
    df["shots_total"] = [5, 1, 7, 9]
    out = build._add_ucl(df, [2024])
    assert out["minutes"].tolist() == [1600, 400, 1800, 2000]
    assert out["cl_minutes"].tolist() == [600, 0, 300, 0]
    assert out["league_minutes"].tolist() == [1000, 400, 1500, 2000]
    assert out["npg_total"].tolist() == [2, 0, 1, 0]
    assert out["shots_total"].tolist() == [15, 1, 11, 9]
    assert out["league_shots_total"].tolist() == [5, 1, 7, 9]
