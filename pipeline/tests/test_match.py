import pandas as pd

from twin.match import link, normalize


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
