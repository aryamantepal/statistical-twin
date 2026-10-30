"""Assemble each model's universe of player-seasons from the raw sources."""

import pandas as pd

from twin.config import LEAGUES, MIN_MINUTES, Model
from twin.match import link
from twin.sources import fbref, statsbomb, understat

FBREF_ONLY = {"sot"}
EXTRA = {"dribbles", "dribble_pct", "final_third", "fouls_won"}
EXTRA_COLS = ["dribbles_att_total", "dribbles_total", "final_third_total", "fouls_won_total"]
COMP_TO_LEAGUE = {comp: key for key, (_, comp, _) in LEAGUES.items()}
COVERAGE = 0.95


def _fbref_frame(fb: pd.DataFrame) -> pd.DataFrame:
    df = fb.rename(columns={"squad": "team"}).copy()
    df["league"] = df["comp"].map(COMP_TO_LEAGUE)
    df["season"] = df["season_end"] - 1
    return df


def _complete_seasons(df: pd.DataFrame, cols: list[str]) -> set[int]:
    cov = df.groupby("season")[cols].agg(lambda s: s.notna().mean())
    return set(cov.index[(cov >= COVERAGE).all(axis=1)])


def _attach_extra(base: pd.DataFrame, extra: pd.DataFrame, log: list[str]) -> pd.DataFrame:
    """Link `base` rows to `extra` rows per league-season and copy EXTRA_COLS across."""
    links = link(base, extra, on=["league", "season"])
    out = base.loc[links["left"]].copy()
    out[EXTRA_COLS] = extra.loc[links["right"], EXTRA_COLS].to_numpy()
    out["link_minutes_gap"] = (
        base.loc[links["left"], "minutes"].to_numpy()
        - extra.loc[links["right"], "minutes"].to_numpy()
    )
    covered = extra.groupby(["league", "season"]).size().index
    for (lg, s), grp in base.groupby(["league", "season"]):
        if (lg, s) not in covered:
            continue
        got = (out["league"].eq(lg) & out["season"].eq(s)).sum()
        if got < len(grp):
            missing = sorted(
                set(grp["player"])
                - set(out.loc[out["league"].eq(lg) & out["season"].eq(s), "player"])
            )
            log.append(f"{lg} {s}: linked {got}/{len(grp)}; unlinked: {', '.join(missing)}")
    return out


def universe(model: Model, log: list[str]) -> pd.DataFrame:
    """Qualified player-seasons with every `<metric>_total` column the model needs."""
    if model.base == "fbref":
        fb = _fbref_frame(fbref.load())
        cols = [f"{m}_total" for m in model.metrics]
        fb = fb[fb["season"].isin(set(model.seasons) & _complete_seasons(fb, cols))]
        df = fb[fb["minutes"] >= MIN_MINUTES].copy()
        df["player_id"] = df["fbref_id"]
        return df.reset_index(drop=True)

    us = understat.load(model.seasons)
    us = us[us["minutes"] >= MIN_MINUTES].reset_index(drop=True)
    if not EXTRA & set(model.metrics):
        return us

    fb = _fbref_frame(fbref.load())
    fb = fb[fb["season"].isin(_complete_seasons(fb, EXTRA_COLS))]
    sb = statsbomb.load([s for s in model.seasons if s in statsbomb.SEASON_ID])
    extra = pd.concat([fb, sb], ignore_index=True)
    have = set(extra.groupby(["league", "season"]).size().index)
    dropped = sorted({(lg, s) for lg, s in zip(us["league"], us["season"])} - have)
    if dropped:
        log.append(
            "no dribble/final-third/fouls-won source for: "
            + ", ".join(f"{lg} {s}" for lg, s in dropped)
        )
    return _attach_extra(us, extra, log).reset_index(drop=True)
