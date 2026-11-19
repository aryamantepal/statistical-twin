"""Homepage hooks, computed from each model's exported JSON: the lead twin pair and the most
isolated seasons. Reads the committed `web/public/data/<model>.json`, so it needs no source data."""

import json

import numpy as np

from twin.config import MODELS, OUT_DIR

LEAD_SUBJECT = ("Lamine Yamal", "2025/26")
LEAD_TWIN_PLAYER = "Lionel Messi"
ISOLATED_COUNT = 6
# Isolation is ranked among attackers only: defenders with almost no attacking output sit in
# the sparse tail of these attacking metrics and would otherwise fill the list.
ISOLATED_ROLE = "FW"


def _ref(rows: dict, i: int) -> dict:
    return {
        "row": i,
        "player": rows["player"][i],
        "team": rows["team"][i],
        "season": rows["season"][i],
    }


def lead(doc: dict) -> dict | None:
    """The subject season paired with the closest season of the twin player, or None if either
    is missing from the model. Distances come from the exported z space (rounded to 0.01)."""
    rows = doc["rows"]
    m = len(doc["metrics"])
    z = np.asarray(rows["z"], dtype=float).reshape(-1, m) / 100
    players = np.asarray(rows["player"])
    seasons = np.asarray(rows["season"])
    subject = np.flatnonzero((players == LEAD_SUBJECT[0]) & (seasons == LEAD_SUBJECT[1]))
    candidates = np.flatnonzero(players == LEAD_TWIN_PLAYER)
    if not len(subject) or not len(candidates):
        return None
    i = int(subject[0])
    d = np.sqrt(((z - z[i]) ** 2).sum(axis=1))
    d[players == players[i]] = np.inf  # the subject's own seasons never count
    j = int(candidates[np.argmin(d[candidates])])
    return {
        "subject": _ref(rows, i),
        "twin": _ref(rows, j),
        "distance": round(float(d[j]), 2),
        "rank": int((d < d[j]).sum()) + 1,
    }


def isolated(doc: dict, count: int = ISOLATED_COUNT) -> list[dict]:
    """Attacking seasons (position includes FW) with the fewest other-player seasons within the
    radius (the export's `iso`). Ties break on the larger typical distance, then row order.
    Rows without a position field all count."""
    rows = doc["rows"]
    iso, typical = np.asarray(rows["iso"]), np.asarray(rows["typical"])
    order = np.lexsort((np.arange(len(iso)), -typical, iso))
    if "pos" in rows:
        order = [i for i in order if ISOLATED_ROLE in rows["pos"][i].split("/")]
    order = order[:count]
    return [{**_ref(rows, int(i)), "isolation": int(iso[i])} for i in order]


def compute(doc: dict) -> dict:
    section: dict = {"radius": doc["radius"], "isolated": isolated(doc)}
    pair = lead(doc)
    if pair:
        section["lead"] = pair
    return section


def write() -> dict:
    """Write hooks.json with one section per exported model."""
    out = {}
    for key in MODELS:
        path = OUT_DIR / f"{key}.json"
        if path.exists():
            out[key] = compute(json.loads(path.read_text()))
    (OUT_DIR / "hooks.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    return out
