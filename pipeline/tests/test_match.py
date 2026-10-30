import pandas as pd

from twin.match import link, normalize
from twin.sources.statsbomb import aggregate_match


def test_normalize_strips_accents_and_punctuation():
    assert normalize("Martin Ødegaard") == "martin odegaard"
    assert normalize("Iličić, Josip") == "ilicic josip"
    assert normalize("Ángel  Di María") == "angel di maria"


def test_link_uses_minutes_to_pick_between_similar_names():
    left = pd.DataFrame(
        {
            "player": ["Neymar", "Gabriel Jesus"],
            "team": ["Barcelona", "Man City"],
            "minutes": [2800, 1900],
            "league": "x",
            "season": 1,
        }
    )
    right = pd.DataFrame(
        {
            "player": ["Gabriel", "Neymar Jr", "Gabriel Jesus"],
            "team": ["Arsenal", "Barcelona", "Manchester City"],
            "minutes": [3000, 2790, 1905],
            "league": "x",
            "season": 1,
        }
    )
    links = link(left, right, on=["league", "season"])
    assert dict(zip(links["left"], links["right"])) == {0: 1, 1: 2}


def test_statsbomb_aggregate_match_counts():
    team = {"name": "A"}
    events = [
        {
            "type": {"name": "Starting XI"},
            "team": team,
            "minute": 0,
            "tactics": {"lineup": [{"player": {"id": 1}}, {"player": {"id": 2}}]},
        },
        {
            "type": {"name": "Dribble"},
            "team": team,
            "minute": 5,
            "player": {"id": 1},
            "dribble": {"outcome": {"name": "Complete"}},
        },
        {
            "type": {"name": "Dribble"},
            "team": team,
            "minute": 6,
            "player": {"id": 1},
            "dribble": {"outcome": {"name": "Incomplete"}},
        },
        {"type": {"name": "Foul Won"}, "team": team, "minute": 7, "player": {"id": 1}},
        # Completed pass into the final third, then one that starts inside it (not counted).
        {
            "type": {"name": "Pass"},
            "team": team,
            "minute": 8,
            "player": {"id": 2},
            "location": [60, 40],
            "pass": {"end_location": [90, 40]},
        },
        {
            "type": {"name": "Pass"},
            "team": team,
            "minute": 9,
            "player": {"id": 2},
            "location": [85, 40],
            "pass": {"end_location": [100, 40]},
        },
        {
            "type": {"name": "Substitution"},
            "team": team,
            "minute": 60,
            "player": {"id": 2},
            "substitution": {"replacement": {"id": 3}},
        },
        {
            "type": {"name": "Pass"},
            "team": team,
            "minute": 90,
            "player": {"id": 3},
            "location": [50, 40],
            "pass": {"end_location": [95, 40], "outcome": {"name": "Incomplete"}},
        },
    ]
    lineups = [
        {
            "lineup": [
                {
                    "player_id": 1,
                    "player_name": "Lionel Andrés Messi Cuccittini",
                    "player_nickname": "Lionel Messi",
                }
            ]
        }
    ]
    rows = {r["sb_player_id"]: r for r in aggregate_match(events, lineups)}
    assert rows[1]["player"] == "Lionel Messi"
    assert (rows[1]["dribbles_att"], rows[1]["dribbles"], rows[1]["fouls_won"]) == (2, 1, 1)
    assert rows[2]["final_third"] == 1 and rows[3]["final_third"] == 0
    assert (rows[1]["minutes"], rows[2]["minutes"], rows[3]["minutes"]) == (90, 60, 30)
