# Statistical Twin

An open-source rebuild of Kickonomics' "statistical twin" analysis. Pick any big-five-league
player-season (1,500+ minutes) and find the seasons most like it, using a nearest-neighbour
model over per-90 percentiles.

- `pipeline/`: Python (uv). Downloads the data, links players across sources, computes
  percentiles, z-scores, neighbours, isolation and map coordinates, then exports static JSON.
- `web/`: Next.js (App Router, TypeScript), a static export. You can search a season and see
  its twins, a percentile dot-plot against any twin, the 2D map, a radial "distance from X" view
  and its isolation stat.

## Method

1. **Universe.** Big-five-league player-seasons with at least 1,500 league minutes. A player who
   moves between two clubs in the same league counts as one season; a player who moves between
   leagues gets one season per league.
2. **Metrics.** The reel's 13 per-90 stats: non-penalty goals, npxG, shots, xG per shot, assists,
   xA, key passes, xGChain, xGBuildup, successful dribbles, dribble success %, final-third
   passes and fouls won. xG per shot and dribble success % are rates; every other metric is per 90.
3. **Percentiles within league-season.** Each metric is ranked against the other qualifying
   players in the same league and season. Ties share the average rank, so the top player is
   at 100.
4. **Z-scores.** Each percentile becomes a normal score, `Φ⁻¹((rank − ½)/n)`, and each column is
   then standardised. (`TWIN_ZSCORE=linear` standardises the raw 0–100 percentile instead.) The
   normal score is the default for two reasons. First, a 100th-percentile season lands about
   2.7σ out instead of being capped at the 1.73σ of a uniform distribution, which is what
   separates the outliers. Second, it comes closer to the reel's isolation numbers (see
   below).
5. **Distance and neighbours.** Plain Euclidean distance across all metrics. A player's own
   other seasons are excluded from their twin list and their isolation count.
6. **Isolation.** The number of other players' seasons within distance 3.5.
7. **Map.** Composite axes, not PCA or UMAP:
   `x = mean z(creator metrics) − mean z(finisher metrics)` and `y = mean percentile`. That gives
   the reel's "finishers ↔ creators" and "stars" axes literally. The axes are deterministic,
   they keep their meaning when data is rebuilt, and unlike PCA their sign never flips. Dot size
   shows minutes. The radial view puts the selected season at the centre: radius is the true
   13-D distance, direction is taken from the map (up = more star, right = more creator), and
   rings sit at d = 2, 4, 6, 8.

The pipeline builds three models, and the app switches between them:

| Model | Metrics | Seasons | Size |
|---|---|---|---|
| `core` | the 13 above | 2015/16–2025/26 | 12,426 |
| `understat` | the 9 Understat metrics | 2014/15–2025/26 | 13,588 |
| `extended` | npG, shots on target, assists | 2009/10–2023/24 | 17,193 |

## Data sources

| Metric | Source | How |
|---|---|---|
| npG, npxG, shots, xG/shot, assists, xA, key passes, xGChain, xGBuildup | [Understat](https://understat.com) | the league-season JSON endpoint behind the league pages (`/getLeagueData/{league}/{season}`) |
| dribbles att./succ., final-third passes, fouls won | [Sofascore](https://www.sofascore.com) | season totals from the JSON API behind Sofascore's league statistics pages, downloaded once by `pipeline/scripts/fetch_sofascore.py` (see below) |
| npG, assists, shots on target (extended model) | [FBref](https://fbref.com) (Opta) | pre-scraped season tables from the [`worldfootballR_data`](https://github.com/JaseZiv/worldfootballR_data) GitHub releases |

Data caveats:

- **Sofascore has no detailed player stats before 2015/16**, so `core` starts there. Understat's
  2014/15 season is only in the `understat` model.
- **"Final-third passes" are Sofascore's accurate passes *in* the final third**, not passes
  *into* it (FBref's definition, which earlier builds used).
- **Dribbles** are Sofascore's: attempted = `totalContest`, completed = `successfulDribbles`.
  Yamal 25/26 is 243 attempted / 133 completed.
- **Linking.** Understat and Sofascore share no player IDs. Players are linked within each
  league-season by name similarity, minutes agreement and team, solved with the Hungarian
  algorithm. 10 of the 12,436 qualifying Understat seasons fail to link, all nickname
  mismatches (Chicharito, Tana, Alfonso Espino). The app lists every one under "Data gaps".
- **Extended model.** Before 2016/17 FBref carries only goals, assists, shots on target and
  cards per player (no shots or fouls won), so the "since 2009" model has just 3 metrics. It is
  far too coarse to resolve a player like Yamal.
- **xG per shot** uses Understat xG (penalties included) divided by all shots.

### The Sofascore download

Sofascore has no public API and blocks non-browser clients, so `fetch_sofascore.py` requests its
internal API with a browser TLS fingerprint (`curl_cffi`). It is run by hand, never in CI: one
request every 2.5 s, about 185 requests for every league-season, each response cached forever in
`data/cache/sofascore/` (gitignored), and it stops on the first error instead of retrying.

```bash
uv run --with curl_cffi python pipeline/scripts/fetch_sofascore.py
```

The raw cache is backed up to the project's Neon Postgres (`sofascore_files` holds the raw
responses, `sofascore_season_stats` the parsed totals). Put the connection string in
`pipeline/.env.local` (`DATABASE_URL`, gitignored), then:

```bash
uv run twin sync push   # back up data/cache/sofascore/ to Neon
uv run twin sync pull   # restore it on a new machine instead of re-downloading
```

Attribution: Understat data © Understat. Dribble, foul and final-third data © Sofascore. FBref
data © Sports Reference / Opta. Data is used here for non-commercial analysis. The concept and
reference numbers come from Kickonomics.

## How close is this to the reel?

| Check | Reel | This build |
|---|---|---|
| Universe (core) | 11,313 | 12,426 |
| Universe (since 2009) | 17,202 | 17,193 |
| Yamal 25/26 dribbles | 243 att. / 133 succ. | 243 / 133 |
| Yamal 25/26 #1 | Messi 15/16 (≈3.1) | Messi 19/20 (1.30). Messi 15/16 is #5. |
| Yamal 25/26, rest of reel top 5 | Neymar 16/17, Iličić 18/19, Sané 23/24, Olise 24/25 | Neymar 16/17 #8, Iličić 18/19 #7, Olise 24/25 #6; Sané 23/24 outside the top 10 |
| Messi 15/16 #1 / #2 | Mbappé 21/22 / Yamal 25/26 | Yamal 25/26 (1.50) / Mbappé 21/22 (1.67) |
| Median isolation | 3,596 / 11,313 (32%) | 3,494 / 12,426 (28%) |

**The reel's names come back, in a slightly different order.** Our top 10 for Yamal 25/26
is four Messi seasons (19/20, 22/23, 17/18, 15/16), Olise twice, Iličić 18/19, Neymar 16/17,
Mahrez 19/20 and Messi 16/17. The reel seems to show each player once; keeping each player's
nearest season gives Messi, Olise, Iličić, Neymar, Mahrez, i.e. four of its five names. The
match also runs the other way: Messi 19/20's nearest twin is Yamal 25/26.

Earlier builds tested "Yamal 23/24", which the reel never used: its card is his 2025/26 season.
Yamal 23/24's #1 is Kingsley Coman 19/20.

The reel's absolute distances (≈3.1 for the nearest) are about 2.5× ours, so it probably
scaled its features differently. Neighbour rankings don't depend on that scale; isolation
counts within 3.5 do.

Reproduce these numbers with `uv run twin show <model> "<player>" <season>`.

## Running the pipeline

```bash
cd pipeline
uv sync
uv run twin build            # all models; or: uv run twin build core
uv run twin show core "Lamine Yamal" 2025/26
uv run pytest
```

`core` needs the Sofascore cache (see above; `uv run twin sync pull` restores it). Other
downloads are cached in `data/cache/`. Output
goes to `web/public/data/*.json` (columnar, about 1.5 MB gzipped per model) and
`data/out/*.parquet`.

## Running and deploying the app

```bash
cd web
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static export in web/out
```

**Vercel, standalone.** Import the repo and set **Root Directory** to `web`. Next.js is detected
automatically, and the app is fully static (`output: "export"`). The committed
`web/public/data/` files are the dataset, so Vercel never runs the pipeline.

**Under aryamantepal.com/statistical-twin.** Build with `NEXT_PUBLIC_BASE_PATH=/statistical-twin`
(set it as a Vercel environment variable). Then either deploy this project and add a rewrite from
the main site (`/statistical-twin/:path*` → `https://<this-project>.vercel.app/statistical-twin/:path*`),
or copy `web/out/` into the main site's static directory.

To refresh the data: re-run `uv run twin build` and commit `web/public/data/`.

## License

MIT. See [LICENSE](LICENSE). The data belongs to its respective owners, as listed above.
