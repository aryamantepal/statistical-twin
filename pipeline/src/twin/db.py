"""Back up the Sofascore cache to the project's Neon Postgres and restore it.

`twin sync push` uploads every cached response plus a parsed per-player table;
`twin sync pull` writes missing cache files back to disk. The build itself only ever reads
the local cache, so CI and Vercel never need the database.
"""

import json
import os
from pathlib import Path

from twin.config import ROOT
from twin.sources import sofascore

ENV_FILE = ROOT / "pipeline" / ".env.local"

SCHEMA = """
create table if not exists sofascore_files (
    name text primary key,
    body jsonb not null,
    synced_at timestamptz not null default now()
);
create table if not exists sofascore_season_stats (
    league text not null,
    season int not null,
    sofascore_id bigint not null,
    player text not null,
    team text not null,
    minutes int not null,
    dribbles_att int not null,
    dribbles int not null,
    fouls_won int not null,
    final_third int not null,
    primary key (league, season, sofascore_id)
);
"""


def _url() -> str:
    for key in ("DATABASE_URL_UNPOOLED", "DATABASE_URL"):
        if os.environ.get(key):
            return os.environ[key]
    if ENV_FILE.exists():
        env = dict(
            line.split("=", 1)
            for line in ENV_FILE.read_text().splitlines()
            if "=" in line and not line.lstrip().startswith("#")
        )
        for key in ("DATABASE_URL_UNPOOLED", "DATABASE_URL"):
            value = env.get(key, "").strip().strip('"')
            if value and "SENSITIVE" not in value:
                return value
    raise SystemExit(f"set DATABASE_URL (Neon connection string) in {ENV_FILE}")


def _connect():
    import psycopg

    return psycopg.connect(_url())


def push() -> None:
    files = sorted(sofascore.DIR.glob("*.json"))
    if not any(sofascore.DIR.glob("*_p*.json")):
        raise SystemExit(f"nothing to push: {sofascore.DIR} is empty")
    stats = sofascore.load(range(2000, 2100))
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA)
        cur.executemany(
            "insert into sofascore_files (name, body) values (%s, %s) "
            "on conflict (name) do update set body = excluded.body, synced_at = now()",
            [(f.name, f.read_text()) for f in files],
        )
        cur.execute("truncate sofascore_season_stats")
        cur.executemany(
            "insert into sofascore_season_stats values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            [
                (
                    r.league,
                    r.season,
                    r.sofascore_id,
                    r.player,
                    r.team,
                    r.minutes,
                    r.dribbles_att_total,
                    r.dribbles_total,
                    r.fouls_won_total,
                    r.final_third_total,
                )
                for r in stats.itertuples()
            ],
        )
    print(f"pushed {len(files)} files and {len(stats)} player-season rows")


def pull() -> None:
    sofascore.DIR.mkdir(parents=True, exist_ok=True)
    wrote = 0
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("select name, body from sofascore_files")
        for name, body in cur:
            path = Path(sofascore.DIR) / name
            if not path.exists():
                path.write_text(json.dumps(body))
                wrote += 1
    print(f"restored {wrote} files into {sofascore.DIR}")
