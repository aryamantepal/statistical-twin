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
| `core` | the 13 above | 2015/16, 2017/18–2023/24 (Bundesliga 2015/16 missing) | 8,903 |
| `understat` | the 9 Understat metrics | 2014/15–2025/26 | 13,588 |
| `extended` | npG, shots on target, assists | 2009/10–2023/24 | 17,193 |

## Data sources

| Metric | Source | How |
|---|---|---|
| npG, npxG, shots, xG/shot, assists, xA, key passes, xGChain, xGBuildup | [Understat](https://understat.com) | the league-season JSON endpoint behind the league pages (`/getLeagueData/{league}/{season}`) |
| dribbles att./succ., final-third passes, fouls won (2017/18+) | [FBref](https://fbref.com) (Opta) | pre-scraped season tables from the [`worldfootballR_data`](https://github.com/JaseZiv/worldfootballR_data) GitHub releases. FBref itself sits behind a bot challenge, and this pipeline does not try to get around it. |
| the same four, 2015/16 | [StatsBomb open data](https://github.com/statsbomb/open-data) | full event data, aggregated per player |
| npG, assists, shots on target (extended model) | FBref via the same mirror | |

Data caveats:

- **No 2016/17 in `core`.** No open source covers dribbles, final-third passes or fouls won for
  a full big-five 2016/17 season, so Neymar 16/17 is only in the `understat` model.
- **No Bundesliga 2015/16 in `core`.** StatsBomb publishes only 34 matches (one club's fixtures).
- **No 2024/25 in `core`.** The mirror's possession and misc tables were last refreshed partway
  through 2024/25, and partial totals would distort the percentiles.
- **"Final-third passes" means completed passes *into* the final third.** That is FBref's
  definition; the StatsBomb aggregation copies it (start x < 80, end x ≥ 80, completed). The reel
  cites Sofascore, whose figure is probably passes *in* the final third. Wingers rank far lower
  on the FBref version: Yamal 23/24 is at the 28th percentile here versus 99th in the reel.
- **Dribbles.** FBref's are Opta take-ons and StatsBomb's are StatsBomb dribbles. The two are
  similar but not identical. This matters less than it might, because percentiles are computed
  within one league-season, which always comes from a single source.
- **Linking.** Understat, FBref and StatsBomb share no player IDs. Players are linked within each
  league-season by name similarity, minutes agreement and team, solved with the Hungarian
  algorithm. 7 of the roughly 8,900 qualifying seasons fail to link (e.g. FBref lists Lee Kang-In in Hangul), and 7 more are dropped
  because the mirror is missing one table for them. The app lists every one under "Data gaps".
- **Extended model.** Before 2016/17 FBref carries only goals, assists, shots on target and
  cards per player (no shots or fouls won), so the "since 2009" model has just 3 metrics. It is
  far too coarse to resolve a player like Yamal.
- **xG per shot** uses Understat xG (penalties included) divided by all shots.

Attribution: Understat data © Understat. FBref data © Sports Reference / Opta. StatsBomb open
data is used under the [StatsBomb public data user agreement](https://github.com/statsbomb/open-data/blob/master/LICENSE.pdf).
Data is used here for non-commercial analysis. The concept and reference numbers come from
Kickonomics.

## How close is this to the reel?

| Check | Reel | This build |
|---|---|---|
| Universe (core) | 11,313 | 8,903 (no 2016/17, no Bundesliga 15/16) |
| Universe (since 2009) | 17,202 | 17,193 |
| Yamal 23/24 #1 | Messi 15/16 (3.06) | Kingsley Coman 19/20 (0.91). Messi 15/16 ranks 3,199th. |
| Messi 15/16 #1 | Mbappé 21/22 | Thauvin 17/18. Neymar 17/18 is #2, Iličić 18/19 #3, Mbappé 21/22 #7. |
| Median isolation | 3,596 / 11,313 (32%) | 2,391 / 8,903 (27%) |
| Yamal's typical distance | ≈12.3 | 5.1 |

**Messi 15/16 does not come out as Yamal 23/24's #1.** The likely reason is that the reel's
"Yamal 23/24" is really his 2024/25 season. In 2023/24 he had 5 non-penalty goals and 5 assists
in 2,186 minutes, which ranks at the 87th percentile for assists, not the reel's 100th. His
2024/25 profile matches the reel's numbers, including the 243 attempted dribbles. With all 13
metrics, 2024/25 can't be tested (see the caveats above). The 9-metric `understat` model can,
and there Yamal 24/25's neighbours include several of the reel's names: Sané 23/24 #5,
Messi 22/23 #7, Olise 24/25 #15, Iličić 18/19 #17 and Messi 15/16 #103. Dribbling, which
Messi and Yamal share most strongly, is exactly what that model lacks.

The reel's absolute distances (3.06 for the nearest, 12.3 typical) are about 2.5× ours. A
typical distance of 12.3 would need an average gap of 3.4σ on every one of 13 standardised
axes, so the reel probably scaled its features differently. Neighbour rankings don't depend on
that scale; isolation counts within 3.5 do.

Reproduce these numbers with `uv run twin show <model> "<player>" <season>`.

## Running the pipeline

```bash
cd pipeline
uv sync
uv run twin build            # all models; or: uv run twin build core
uv run twin show core "Lamine Yamal" 2023/24
uv run pytest
```

The first run downloads about 4 GB of StatsBomb event JSON, but only a few counts per player
per match are cached, so later runs are quick. Downloads are cached in `data/cache/`. Output
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
