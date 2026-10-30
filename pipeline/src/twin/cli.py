"""`twin build [model ...]` runs the pipeline; `twin show <model> <player> <season>` inspects it."""

import argparse
import json

import pandas as pd

from twin.config import MODELS, OUT_DIR, TOP_N


def show(model: str, player: str, season: str, k: int = 10) -> None:
    doc = json.loads((OUT_DIR / f"{model}.json").read_text())
    rows, metrics = doc["rows"], doc["metrics"]
    m = len(metrics)
    hits = [
        i
        for i, (p, s) in enumerate(zip(rows["player"], rows["season"]))
        if player.lower() in p.lower() and s == season
    ]
    if not hits:
        raise SystemExit(f"no {player} {season} in {model}")
    i = hits[0]
    print(f"{rows['player'][i]} {rows['season'][i]} ({rows['team'][i]}, {rows['minutes'][i]} min)")
    for j, met in enumerate(metrics):
        print(
            f"  {met['label']:<34} {rows['raw'][i * m + j] / 1000:7.3f}  pct {rows['pct'][i * m + j] / 10:5.1f}"
        )
    print("nearest:")
    for r in range(min(k, TOP_N)):
        j, d = rows["nn"][i * TOP_N + r], rows["nnd"][i * TOP_N + r]
        print(f"  #{r + 1} {rows['player'][j]} {rows['season'][j]} ({rows['team'][j]}) {d:.2f}")
    iso = pd.Series(rows["iso"])
    print(f"typical distance {rows['typical'][i]:.2f}")
    print(
        f"isolation: {rows['iso'][i]} within {doc['radius']} (median {doc['medianIsolation']:.0f}); "
        f"{int((iso < rows['iso'][i]).sum())} seasons more isolated of {len(iso)}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(prog="twin")
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("models", nargs="*", default=list(MODELS))
    s = sub.add_parser("show")
    s.add_argument("model")
    s.add_argument("player")
    s.add_argument("season")
    s.add_argument("-k", type=int, default=10)
    args = parser.parse_args()

    if args.cmd == "build":
        from twin.export import write

        for key in args.models:
            write(MODELS[key])
        manifest = [
            {"key": m.key, "label": m.label, "description": m.description}
            for m in MODELS.values()
            if (OUT_DIR / f"{m.key}.json").exists()
        ]
        (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=1))
    else:
        show(args.model, args.player, args.season, args.k)


if __name__ == "__main__":
    main()
