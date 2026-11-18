import numpy as np

from twin.hooks import compute, isolated, lead


def doc(players, seasons, z, iso, typical=None):
    n = len(players)
    return {
        "radius": 3.5,
        "metrics": [{}] * len(z[0]),
        "rows": {
            "player": players,
            "team": ["T"] * n,
            "season": seasons,
            "z": (np.array(z) * 100).astype(int).ravel().tolist(),
            "iso": iso,
            "typical": typical or [1.0] * n,
        },
    }


def test_lead_picks_nearest_messi_season_and_rank_ignores_own_seasons():
    d = doc(
        ["Lamine Yamal", "Lamine Yamal", "Lionel Messi", "Lionel Messi", "Other"],
        ["2025/26", "2024/25", "2018/19", "2019/20", "2025/26"],
        # Yamal 25/26 at 0; his own 24/25 at 0.1 (ignored); Messi at 3 and 1; Other at 0.5.
        [[0.0], [0.1], [3.0], [1.0], [0.5]],
        [0] * 5,
    )
    pair = lead(d)
    assert pair["twin"]["season"] == "2019/20"
    assert pair["distance"] == 1.0
    assert pair["rank"] == 2  # Other is closer
    assert pair["subject"]["row"] == 0


def test_lead_omitted_without_subject_season():
    d = doc(["Lamine Yamal", "Lionel Messi"], ["2024/25", "2019/20"], [[0.0], [1.0]], [0, 0])
    assert lead(d) is None
    assert "lead" not in compute(d)


def test_isolated_orders_by_fewest_neighbours_then_typical_distance():
    n = 8
    d = doc(
        [f"p{i}" for i in range(n)],
        ["2020/21"] * n,
        [[float(i)] for i in range(n)],
        [5, 1, 9, 1, 3, 7, 2, 8],
        typical=[1.0, 1.0, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0],
    )
    got = isolated(d, count=6)
    assert [h["row"] for h in got] == [3, 1, 6, 4, 0, 5]  # row 3 beats row 1 on typical distance
    assert [h["isolation"] for h in got] == [1, 1, 2, 3, 5, 7]
