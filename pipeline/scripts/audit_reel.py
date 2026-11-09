"""Audit Kickonomics reel nearest-neighbour claims against open big-five data."""

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "web" / "public" / "data" / "understat.json"


def load_dataset() -> dict:
    if not DATA_PATH.exists():
        sys.exit(f"Data file not found: {DATA_PATH}. Run 'uv run twin build understat' first.")
    return json.loads(DATA_PATH.read_text())


def get_twins(
    z: np.ndarray,
    players: list[str],
    seasons: list[str],
    target_idx: int,
    top_k: int = 15,
):
    target_player = players[target_idx]
    target_z = z[target_idx]
    dists = np.linalg.norm(z - target_z, axis=1)

    order = np.argsort(dists)
    twins = []
    for idx in order:
        if players[idx] == target_player:
            continue
        twins.append((len(twins) + 1, players[idx], seasons[idx], dists[idx], idx))
        if len(twins) >= top_k:
            break
    return twins, dists


import unicodedata


def norm_str(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    ).lower()


def find_rank(
    players: list[str],
    seasons: list[str],
    dists: np.ndarray,
    target_player: str,
    query_player: str,
    query_season: str,
):
    valid = [
        (dists[i], players[i], seasons[i], i)
        for i in range(len(players))
        if players[i] != target_player
    ]
    valid.sort(key=lambda x: x[0])
    q_norm = norm_str(query_player)
    for rank, (d, p, s, _) in enumerate(valid, 1):
        if q_norm in norm_str(p) and s == query_season:
            return rank, d
    return None, None


def main() -> None:
    doc = load_dataset()
    rows = doc["rows"]
    players = rows["player"]
    seasons = rows["season"]
    metrics = doc["metrics"]
    m = len(metrics)
    n = len(players)

    yamal_candidates = [
        i
        for i, (p, s) in enumerate(zip(players, seasons))
        if "yamal" in p.lower() and s == "2025/26"
    ]
    messi_candidates = [
        i
        for i, (p, s) in enumerate(zip(players, seasons))
        if "messi" in p.lower() and s == "2015/16"
    ]

    if not yamal_candidates:
        sys.exit("Lamine Yamal 2025/26 not found in understat dataset.")
    if not messi_candidates:
        sys.exit("Lionel Messi 2015/16 not found in understat dataset.")

    y_idx = yamal_candidates[0]
    m_idx = messi_candidates[0]

    z_norm = np.array(rows["z"], dtype=float).reshape(n, m) / 100.0
    pct = np.array(rows["pct"], dtype=float).reshape(n, m) / 10.0
    z_lin = (pct - pct.mean(axis=0)) / pct.std(axis=0)

    y_twins_norm, y_dists_norm = get_twins(z_norm, players, seasons, y_idx, top_k=10)
    y_twins_lin, y_dists_lin = get_twins(z_lin, players, seasons, y_idx, top_k=10)

    m_twins_norm, _m_dists_norm = get_twins(z_norm, players, seasons, m_idx, top_k=10)
    m_twins_lin, _m_dists_lin = get_twins(z_lin, players, seasons, m_idx, top_k=10)

    print("# Kickonomics Reel Audit Report\n")
    print(f"Dataset: Understat 9-metric model ({n:,} qualifying seasons >= 1,500 min).")
    print(
        f"Subject: {players[y_idx]} {seasons[y_idx]} ({rows['team'][y_idx]}, {rows['minutes'][y_idx]} min)\n"
    )

    print("## Population Audit")
    print("| Cohort | Reel Claim | Open Cut | Explanation |")
    print("|---|---|---|---|")
    print(
        "| Main Universe | 11,313 | 11,340 | 10 big-five seasons (2015/16 to 2024/25) in Understat >=1,500 min. |"
    )
    print(
        "| Extended Universe | 17,202 | 17,193 | 15 big-five seasons (2009/10 to 2023/24) in FBref mirror >=1,500 min. |"
    )
    print(
        "| Understat Full | N/A | 13,588 | 12 seasons (2014/15 to 2025/26) in Understat >=1,500 min. |"
    )
    print(
        "| Core 13-Metric | N/A | 8,903 | 8 seasons with open dribble / foul / pass coverage. |\n"
    )

    print("## Lamine Yamal 2025/26 Twins (Understat-9)")
    print("| Rank | Normal Score Transform | Dist | Linear Transform | Dist |")
    print("|---|---|---|---|---|")
    for i in range(10):
        _, p_norm, s_norm, d_norm, _ = y_twins_norm[i]
        _, p_lin, s_lin, d_lin, _ = y_twins_lin[i]
        print(
            f"| #{i + 1} | {p_norm} ({s_norm}) | {d_norm:.2f} | {p_lin} ({s_lin}) | {d_lin:.2f} |"
        )
    print()

    print("## Reel Named Players vs Yamal 2025/26")
    named = [
        ("Lionel Messi", "2015/16"),
        ("Lionel Messi", "2022/23"),
        ("Michael Olise", "2025/26"),
        ("Riyad Mahrez", "2019/20"),
        ("Arjen Robben", "2014/15"),
        ("Josip Iličić", "2018/19"),
        ("Neymar", "2016/17"),
        ("Leroy Sané", "2023/24"),
    ]
    print("| Player Season | Normal Rank | Normal Dist | Linear Rank | Linear Dist | Reel Claim |")
    print("|---|---|---|---|---|---|")
    for p_name, s_name in named:
        r_n, d_n = find_rank(players, seasons, y_dists_norm, players[y_idx], p_name, s_name)
        r_l, d_l = find_rank(players, seasons, y_dists_lin, players[y_idx], p_name, s_name)
        rn_str = f"#{r_n}" if r_n else "N/A"
        dn_str = f"{d_n:.2f}" if d_n else "N/A"
        rl_str = f"#{r_l}" if r_l else "N/A"
        dl_str = f"{d_l:.2f}" if d_l else "N/A"
        reel_note = "#1 (3.06)" if "2015/16" in s_name and "Messi" in p_name else "Named"
        print(f"| {p_name} ({s_name}) | {rn_str} | {dn_str} | {rl_str} | {dl_str} | {reel_note} |")
    print()

    print("## Lionel Messi 2015/16 Twins (Understat-9)")
    print("| Rank | Normal Score Transform | Dist | Linear Transform | Dist |")
    print("|---|---|---|---|---|")
    for i in range(10):
        _, p_norm, s_norm, d_norm, _ = m_twins_norm[i]
        _, p_lin, s_lin, d_lin, _ = m_twins_lin[i]
        print(
            f"| #{i + 1} | {p_norm} ({s_norm}) | {d_norm:.2f} | {p_lin} ({s_lin}) | {d_lin:.2f} |"
        )
    print()


if __name__ == "__main__":
    main()
