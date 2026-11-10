"""Assemble each model's universe of player-seasons from the raw sources."""

import pandas as pd

from twin.config import LEAGUES, MIN_MINUTES, UCL_FLOOR, Model
from twin.match import link
from twin.sources import fbref, sofascore, understat

EXTRA = {"dribbles", "dribble_pct", "final_third", "fouls_won"}
EXTRA_COLS = ["dribbles_att_total", "dribbles_total", "final_third_total", "fouls_won_total"]
COMP_TO_LEAGUE = {comp: key for key, (_, comp, _) in LEAGUES.items()}
COVERAGE = 0.95
# Columns the CL model adds Champions League totals to.
UCL_COUNTS = ["npg_total", "shots_total", "assists_total", "key_passes_total", *EXTRA_COLS]


def _fbref_frame(fb: pd.DataFrame) -> pd.DataFrame:
    df = fb.rename(columns={"squad": "team"}).copy()
    df["league"] = df["comp"].map(COMP_TO_LEAGUE)
    df["season"] = df["season_end"] - 1
    return df


def _complete_seasons(df: pd.DataFrame, cols: list[str]) -> set[int]:
    cov = df.groupby("season")[cols].agg(lambda s: s.notna().mean())
    return set(cov.index[(cov >= COVERAGE).all(axis=1)])


def _attach_extra(base: pd.DataFrame, extra: pd.DataFrame, log: list[str]) -> pd.DataFrame:
    """Link `base` rows to `extra` rows per league-season and copy EXTRA_COLS across.

    Only base rows with MIN_MINUTES or more are reported as unlinked.
    """
    links = link(base, extra, on=["league", "season"])
    out = base.loc[links["left"]].copy()
    out[EXTRA_COLS] = extra.loc[links["right"], EXTRA_COLS].to_numpy()
    out["sofascore_id"] = extra.loc[links["right"], "sofascore_id"].to_numpy()
    out["link_minutes_gap"] = (
        base.loc[links["left"], "minutes"].to_numpy()
        - extra.loc[links["right"], "minutes"].to_numpy()
    )
    covered = extra.groupby(["league", "season"]).size().index
    linked = base.index.isin(links["left"])
    for (lg, s), grp in base[base["minutes"] >= MIN_MINUTES].groupby(["league", "season"]):
        if (lg, s) not in covered:
            continue
        missing = sorted(grp.loc[~linked[base.index.get_indexer(grp.index)], "player"])
        if missing:
            got = len(grp) - len(missing)
            log.append(f"{lg} {s}: linked {got}/{len(grp)}; unlinked: {', '.join(missing)}")
    return out


def _add_ucl(df: pd.DataFrame, seasons) -> pd.DataFrame:
    """Add each player's Champions League totals to his league counts and minutes.

    Joined on Sofascore's player id. A player who changed big-five league mid-season gets his
    CL games on the row with more league minutes. The league-only (xG) metrics keep league
    minutes and league shots via `league_minutes` / `league_shots_total`.
    """
    cl = sofascore.load(seasons, ucl=True)
    cl["npg_total"] = cl["goals_total"] - cl["penalty_goals_total"]
    key = ["sofascore_id", "season"]
    cl = cl.set_index(key)[[*UCL_COUNTS, "minutes"]]
    add = df[key].join(cl, on=key).drop(columns=key).fillna(0)
    primary = ~df.sort_values("minutes", ascending=False).duplicated(key)
    add.loc[~primary.reindex(df.index)] = 0
    out = df.copy()
    out["league_minutes"] = out["minutes"]
    out["league_shots_total"] = out["shots_total"]
    out[UCL_COUNTS] = out[UCL_COUNTS].to_numpy(float) + add[UCL_COUNTS].to_numpy(float)
    out["cl_minutes"] = add["minutes"].astype(int)
    out["minutes"] = out["league_minutes"] + out["cl_minutes"]
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
    us = us[us["minutes"] >= (UCL_FLOOR if model.ucl else MIN_MINUTES)].reset_index(drop=True)
    if not EXTRA & set(model.metrics):
        return us

    extra = sofascore.load(model.seasons)
    have = set(extra.groupby(["league", "season"]).size().index)
    dropped = sorted({(lg, s) for lg, s in zip(us["league"], us["season"])} - have)
    if dropped:
        log.append(
            "no dribble/final-third/fouls-won source for: "
            + ", ".join(f"{lg} {s}" for lg, s in dropped)
        )
    out = _attach_extra(us, extra, log)
    if model.ucl:
        out = _add_ucl(out, model.seasons)
        out = out[out["minutes"] >= MIN_MINUTES]
    return out.reset_index(drop=True)
