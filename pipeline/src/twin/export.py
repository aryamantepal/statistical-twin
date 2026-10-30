"""Run a model end to end and write compact columnar JSON for the web app."""

import json

import numpy as np
import pandas as pd

from twin import build, features
from twin import model as mdl
from twin.config import (
    ISOLATION_RADIUS,
    LEAGUES,
    METRICS,
    OUT_DIR,
    ROOT,
    TOP_N,
    ZSCORE,
    Model,
    season_label,
)


def run(model: Model) -> tuple[pd.DataFrame, dict]:
    log: list[str] = []
    df = build.universe(model, log)
    metrics = list(model.metrics)
    raw = features.derive(df, metrics)
    incomplete = raw.isna().any(axis=1)
    for r in df[incomplete].itertuples():
        log.append(f"dropped (source gap): {r.player} {r.team} {season_label(int(r.season))}")
    df, raw = df[~incomplete].reset_index(drop=True), raw[~incomplete].reset_index(drop=True)
    groups = [df["league"], df["season"]]
    pct = features.percentiles(raw, groups)
    scores = features.normal_scores(raw, groups) if ZSCORE == "normal" else pct
    z, mean, std = mdl.zscore(scores.to_numpy())
    nb = mdl.neighbours(z, df["player_id"].to_numpy(), TOP_N, ISOLATION_RADIUS)
    x, y = mdl.map_axes(z, pct.to_numpy(), [METRICS[m].axis for m in metrics])

    out = df[["player_id", "player", "team", "league", "season", "minutes"]].copy()
    out[[f"{m}" for m in metrics]] = raw.to_numpy()
    out[[f"{m}_pct" for m in metrics]] = pct.to_numpy()
    out["x"], out["y"] = x, y
    out["isolation"], out["typical"] = nb.isolation, nb.typical

    doc = {
        "model": {"key": model.key, "label": model.label, "description": model.description},
        "metrics": [
            {"key": m, "label": METRICS[m].label, "source": METRICS[m].source} for m in metrics
        ],
        "leagues": {k: v[0] for k, v in LEAGUES.items()},
        "radius": ISOLATION_RADIUS,
        "mean": np.round(mean, 4).tolist(),
        "std": np.round(std, 4).tolist(),
        "medianIsolation": float(np.median(nb.isolation)),
        "log": log,
        "rows": {
            "id": out["player_id"].astype(str).tolist(),
            "player": out["player"].tolist(),
            "team": out["team"].astype(str).tolist(),
            "league": out["league"].tolist(),
            "season": [season_label(int(s)) for s in out["season"]],
            "minutes": out["minutes"].astype(int).tolist(),
            # Percentiles ×10 as ints, raw per-90 values ×1000 as ints: row-major, len(metrics) per row.
            "pct": np.rint(pct.to_numpy() * 10).astype(int).ravel().tolist(),
            "raw": np.rint(raw.to_numpy() * 1000).astype(int).ravel().tolist(),
            # Standardised scores ×100: the space distances are measured in.
            "z": np.rint(z * 100).astype(int).ravel().tolist(),
            "x": np.round(x, 3).tolist(),
            "y": np.round(y, 2).tolist(),
            "iso": nb.isolation.tolist(),
            "typical": np.round(nb.typical, 2).tolist(),
            "nn": nb.index.ravel().tolist(),
            "nnd": np.round(nb.distance, 2).ravel().tolist(),
        },
    }
    return out, doc


def write(model: Model) -> pd.DataFrame:
    out, doc = run(model)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / f"{model.key}.json").write_text(
        json.dumps(doc, separators=(",", ":"), ensure_ascii=False)
    )
    parquet_dir = ROOT / "data" / "out"
    parquet_dir.mkdir(parents=True, exist_ok=True)
    out.to_parquet(parquet_dir / f"{model.key}.parquet", index=False)
    print(f"[{model.key}] {len(out)} seasons, median isolation {doc['medianIsolation']:.0f}")
    for line in doc["log"]:
        print(f"[{model.key}]   {line}")
    return out
