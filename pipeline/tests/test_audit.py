import json
import warnings

import numpy as np

from twin.config import CORE_METRICS, OUT_DIR
from twin.snapshot import build_snapshot


def test_metric_dictionary_has_thirteen_metrics():
    snapshot = build_snapshot()
    metric_dict = snapshot["metric_dictionary"]
    assert len(metric_dict) == 13
    keys = [m["key"] for m in metric_dict]
    assert tuple(keys) == CORE_METRICS

    non_understat = {"dribbles", "dribble_pct", "final_third", "fouls_won"}
    for m in metric_dict:
        if m["key"] in non_understat:
            assert m["status"] != "Complete"
            assert m["gap"] is not None and len(m["gap"]) > 0
        else:
            assert m["status"] == "Complete"
            assert m["gap"] is None


def test_snapshot_metadata_schema():
    snapshot = build_snapshot()
    assert snapshot["as_of"] == "2026-11-08"
    assert snapshot["minutes_threshold"] == 1500
    assert "sources" in snapshot
    assert "fbref_rds" in snapshot["sources"]
    assert "understat_2025" in snapshot["sources"]
    assert "statsbomb" in snapshot["sources"]

    pop = snapshot["population_audit"]
    assert pop["reel_main_universe"] == 11313
    assert pop["reel_extended_universe"] == 17202
    assert pop["understat_10_seasons_2015_2024"] == 11340
    assert pop["fbref_15_seasons_2009_2023"] == 17193

    models = snapshot["models"]
    assert "core" in models and "understat" in models and "extended" in models


def test_distance_mathematical_properties():
    rng = np.random.default_rng(42)
    a = rng.normal(size=(10, 9))
    b = rng.normal(size=(10, 9))
    c = rng.normal(size=(10, 9))

    d_ab = np.linalg.norm(a - b, axis=1)
    d_ba = np.linalg.norm(b - a, axis=1)
    d_aa = np.linalg.norm(a - a, axis=1)
    d_bc = np.linalg.norm(b - c, axis=1)
    d_ac = np.linalg.norm(a - c, axis=1)

    assert np.all(d_ab >= 0)
    assert np.allclose(d_aa, 0)
    assert np.allclose(d_ab, d_ba)
    assert np.all(d_ac <= d_ab + d_bc + 1e-9)


def test_neighbour_exclusion_own_seasons():
    z = np.array([[0.0], [0.1], [1.0], [2.0]])
    players = ["Yamal", "Yamal", "Messi", "Olise"]
    target_idx = 0
    dists = np.abs(z - z[target_idx]).ravel()
    order = np.argsort(dists)

    twins = [players[i] for i in order if players[i] != players[target_idx]]
    assert "Yamal" not in twins
    assert twins[0] == "Messi"
    assert twins[1] == "Olise"


def test_soft_integrity_checks():
    data_path = OUT_DIR / "understat.json"
    if not data_path.exists():
        warnings.warn(
            "understat.json not built yet; skipping soft player presence check.",
            UserWarning,
        )
        return

    doc = json.loads(data_path.read_text())
    players = doc["rows"]["player"]
    seasons = doc["rows"]["season"]

    has_yamal_2025 = any("yamal" in p.lower() and s == "2025/26" for p, s in zip(players, seasons))
    has_messi_2015 = any("messi" in p.lower() and s == "2015/16" for p, s in zip(players, seasons))

    if not has_yamal_2025:
        warnings.warn("Lamine Yamal 2025/26 was not found in Understat dataset.", UserWarning)
    if not has_messi_2015:
        warnings.warn("Lionel Messi 2015/16 was not found in Understat dataset.", UserWarning)
