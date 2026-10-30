"""StatsBomb open data: big-five 2015/16 event data, aggregated to player-season totals.

Fills the 2015/16 gap for the four non-Understat metrics (FBref's advanced tables start in
2017/18). Each match's events are reduced to a few counts per player and cached, so the
~4 GB of raw event JSON is only streamed once.
"""

import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pandas as pd

from twin.config import CACHE_DIR, LEAGUES
from twin.sources.http import USER_AGENT, cached_json

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
SEASON_ID = {2015: 27}
FINAL_THIRD_X = 80  # pitch is 120 long
OFF_CARDS = {"Red Card", "Second Yellow"}


def _get(client: httpx.Client, path: str):
    for attempt in range(4):
        try:
            r = client.get(f"{BASE}/{path}")
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError:
            if attempt == 3:
                raise
    return None


def aggregate_match(events: list[dict], lineups: list[dict]) -> list[dict]:
    """Per-player counts and approximate minutes for one match."""
    nickname = {
        p["player_id"]: p.get("player_nickname") or p["player_name"]
        for team in lineups
        for p in team["lineup"]
    }
    end = max(e["minute"] for e in events)
    on, off, team_of, stats = {}, {}, {}, {}

    def bump(pid, key):
        stats.setdefault(pid, {"dribbles_att": 0, "dribbles": 0, "fouls_won": 0, "final_third": 0})
        stats[pid][key] += 1

    for e in events:
        kind = e["type"]["name"]
        if kind == "Starting XI":
            for p in e["tactics"]["lineup"]:
                on[p["player"]["id"]] = 0
                team_of[p["player"]["id"]] = e["team"]["name"]
            continue
        pid = e.get("player", {}).get("id")
        if pid is None:
            continue
        team_of.setdefault(pid, e["team"]["name"])
        if kind == "Substitution":
            off[pid] = e["minute"]
            rep = e["substitution"]["replacement"]["id"]
            on[rep] = e["minute"]
            team_of[rep] = e["team"]["name"]
        elif kind == "Player Off":
            off[pid] = e["minute"]
        elif kind in ("Foul Committed", "Bad Behaviour"):
            card = e.get(kind.lower().replace(" ", "_"), {}).get("card", {}).get("name")
            if card in OFF_CARDS:
                off[pid] = e["minute"]
        elif kind == "Dribble":
            bump(pid, "dribbles_att")
            if e["dribble"].get("outcome", {}).get("name") == "Complete":
                bump(pid, "dribbles")
        elif kind == "Foul Won":
            bump(pid, "fouls_won")
        elif kind == "Pass":
            p = e["pass"]
            if (
                "outcome" not in p  # completed
                and e["location"][0] < FINAL_THIRD_X <= p["end_location"][0]
            ):
                bump(pid, "final_third")

    rows = []
    for pid, start in on.items():
        s = stats.get(pid, {"dribbles_att": 0, "dribbles": 0, "fouls_won": 0, "final_third": 0})
        rows.append(
            {
                "sb_player_id": pid,
                "player": nickname.get(pid, str(pid)),
                "team": team_of.get(pid),
                "minutes": max(0, off.get(pid, end) - start),
                **s,
            }
        )
    return rows


def _match_rows(client: httpx.Client, match_id: int) -> list[dict]:
    path = CACHE_DIR / "statsbomb" / "matches" / f"{match_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    rows = aggregate_match(
        _get(client, f"events/{match_id}.json"), _get(client, f"lineups/{match_id}.json")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows))
    return rows


def load(seasons=(2015,), workers: int = 8) -> pd.DataFrame:
    frames = []
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=120) as client:
        for season in seasons:
            if season not in SEASON_ID:
                continue
            for league, (_, _, comp_id) in LEAGUES.items():
                matches = cached_json(
                    f"{BASE}/matches/{comp_id}/{SEASON_ID[season]}.json",
                    Path("statsbomb") / f"matches_{comp_id}_{SEASON_ID[season]}.json",
                )
                ids = [m["match_id"] for m in matches]
                teams = {m["home_team"]["home_team_name"] for m in matches}
                if len(ids) < 0.95 * len(teams) * (len(teams) - 1):
                    # e.g. Bundesliga 2015/16 is published for a single club only.
                    print(f"statsbomb {league} {season}: only {len(ids)} matches, skipping")
                    continue
                with ThreadPoolExecutor(workers) as pool:
                    per_match = list(pool.map(lambda i: _match_rows(client, i), ids))
                df = pd.DataFrame([r for rows in per_match for r in rows])
                agg = df.groupby("sb_player_id", as_index=False).agg(
                    player=("player", "first"),
                    team=("team", lambda s: ",".join(dict.fromkeys(s))),
                    minutes=("minutes", "sum"),
                    dribbles_att_total=("dribbles_att", "sum"),
                    dribbles_total=("dribbles", "sum"),
                    fouls_won_total=("fouls_won", "sum"),
                    final_third_total=("final_third", "sum"),
                )
                agg["league"] = league
                agg["season"] = season
                print(f"statsbomb {league} {season}: {len(ids)} matches, {len(agg)} players")
                frames.append(agg)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
