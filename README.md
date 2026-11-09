# Statistical Twin

An open-source rebuild of Kickonomics' "statistical twin" analysis. Pick any big-five-league
player-season (1,500+ minutes) and find the seasons most like it, using a nearest-neighbour
model over per-90 percentiles.

- `pipeline/`: Python (uv). Downloads the data, links players across sources, computes
  percentiles, z-scores, neighbours, isolation and map coordinates, then exports static JSON.
- `web/`: Next.js (App Router, TypeScript), a static export. You can search a season and see
  its twins, a percentile dot-plot against any twin, the 2D map, a radial distance view
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
   separates the outliers. Second, it comes closer to the reel's isolation numbers.
5. **Distance and neighbours.** Plain Euclidean distance across all metrics. A player's own
   other seasons are excluded from their twin list and their isolation count.
6. **Isolation.** The number of other players' seasons within distance 3.5.
7. **Map.** Composite axes, not PCA or UMAP:
   `x = mean z(creator metrics) − mean z(finisher metrics)` and `y = mean percentile`. That gives
   the reel's "finishers ↔ creators" and "stars" axes literally. The axes are deterministic,
   they keep their meaning when data is rebuilt, and unlike PCA their sign never flips. Dot size
   shows minutes. The radial view puts the selected season at the centre: radius is the true
   multidimensional distance, direction is taken from the map, and rings sit at d = 2, 4, 6, 8.

The pipeline builds three models, and the app switches between them:

| Model | Metrics | Seasons | Size |
|---|---|---|---|
| `core` | the 13 above | 2015/16, 2017/18–2023/24 (Bundesliga 2015/16 missing) | 8,903 |
| `understat` | the 9 Understat metrics | 2014/15–2025/26 | 13,588 |
| `extended` | npG, shots on target, assists | 2009/10–2023/24 | 17,193 |

## Data Sources and Gaps

| Metric | Source | Status | Open Data Gap |
|---|---|---|---|
| npG, npxG, shots, xG/shot, assists, xA, key passes, xGChain, xGBuildup | Understat | Complete (2014/15–2025/26) | None. 13,588 qualifying seasons across all 5 leagues. |
| Successful dribbles | FBref (Opta) / StatsBomb | Partial | Sofascore closed API. FBref mirror frozen Oct 2024. StatsBomb covers only 2015/16. |
| Dribble success % | FBref (Opta) / StatsBomb | Partial | Sofascore closed API. FBref mirror frozen Oct 2024. StatsBomb covers only 2015/16. |
| Final-third passes | FBref (Opta) / StatsBomb | Partial | Sofascore closed API. FBref mirror frozen Oct 2024. StatsBomb covers only 2015/16. Passes into vs within final third. |
| Fouls won | FBref (Opta) / StatsBomb | Partial | Sofascore closed API. FBref mirror frozen Oct 2024. StatsBomb covers only 2015/16. |
| npG, assists, shots on target (extended model) | FBref via worldfootballR_data | Complete (2009/10–2023/24) | Pre-2017/18 advanced tables absent. |

Data caveats:

- **Missing 2025/26 open dribble and pass data.** The reel explicitly evaluates Lamine Yamal
  2025/26 (age 18, 2,291 min, 133 completed dribbles of 243 attempted, 54.7% success rate).
  The reel cites Sofascore for dribbles, dribble %, final-third passes and fouls won. Sofascore
  has no open sports data API. The FBref mirror (`worldfootballR_data`) stopped refreshing in
  October 2024. Because open sources cannot supply those 4 metrics for 2025/26, the 9-metric
  Understat model is the strongest reproducible pipeline supported by open data.
- **No 2016/17 in `core`.** No open source covers dribbles, final-third passes or fouls won for
  a full big-five 2016/17 season, so Neymar 16/17 is only in the `understat` model.
- **No Bundesliga 2015/16 in `core`.** StatsBomb publishes only 34 matches (one club's fixtures).
- **"Final-third passes" means completed passes into the final third.** That is FBref's
  definition; the StatsBomb aggregation copies it (start x < 80, end x ≥ 80, completed). The reel
  cites Sofascore, whose figure is probably passes within the final third. Wingers rank far lower
  on the FBref version.
- **Dribbles.** FBref's are Opta take-ons and StatsBomb's are StatsBomb dribbles.
- **Linking.** Understat, FBref and StatsBomb share no player IDs. Players are linked within each
  league-season by name similarity, minutes agreement and team, solved with the Hungarian
  algorithm. 7 of the roughly 8,900 qualifying seasons fail to link, and 7 more are dropped
  because the mirror is missing one table for them.
- **Positioning and tracking.** Tactical positioning and physical tracking data are proprietary
  and out of scope for open data.

Attribution: Understat data © Understat. FBref data © Sports Reference / Opta. StatsBomb open
data is used under the StatsBomb public data user agreement. Data is used here for
non-commercial analysis. The concept and reference numbers come from Kickonomics.

## Population Audit

| Cohort | Reel Claim | Open Data Cut | Explanation |
|---|---|---|---|
| Main Universe | 11,313 | 11,340 | Exactly 10 big-five seasons (2015/16 through 2024/25) in Understat with >= 1,500 min. |
| Extended Universe | 17,202 | 17,193 | Exactly 15 big-five seasons (2009/10 through 2023/24) in FBref with >= 1,500 min. |
| Understat Full | N/A | 13,588 | All 12 available seasons (2014/15 through 2025/26) in Understat with >= 1,500 min. |
| Core 13-Metric | N/A | 8,903 | 8 qualifying seasons with open dribble, foul, and passing data. |

## Reel Nearest-Neighbour Audit

Understat 9-metric model nearest neighbours for Lamine Yamal 2025/26 and Lionel Messi 2015/16:

| Query Season | Reel Claim | Understat-9 (Normal Transform) | Understat-9 (Linear Transform) |
|---|---|---|---|
| **Yamal 2025/26 #1** | Messi 15/16 (3.06) | Lionel Messi 22/23 (0.62) | Lionel Messi 22/23 (0.14) |
| **Yamal 2025/26 #2** | Olise 25/26 | Michael Olise 25/26 (0.69) | Lionel Messi 19/20 (0.15) |
| **Yamal 2025/26 #3** | Mahrez 19/20 | Riyad Mahrez 19/20 (0.92) | Arjen Robben 14/15 (0.16) |
| **Yamal 2025/26 #4** | Robben 14/15 | Arjen Robben 14/15 (1.08) | Josip Iličić 18/19 (0.17) |
| **Yamal 2025/26 #5** | Messi 19/20 | Lionel Messi 19/20 (1.10) | Lionel Messi 20/21 (0.21) |
| **Messi 15/16 Rank** | #1 (3.06) | #11 (1.25) | #54 (0.64) |
| **Messi 15/16 #1** | Mbappé 21/22 | Mohamed Salah 24/25 (#9 Yamal 25/26 [1.25], #13 Mbappé 21/22 [1.28]) | Bradley Barcola 24/25 (#11 Mbappé 21/22 [0.31], #60 Yamal 25/26 [0.64]) |

Under the normal transform on Understat-9, Yamal's top five matches the reel's named set:
Messi 22/23 is #1, Olise 25/26 is #2, Mahrez 19/20 is #3, Robben 14/15 is #4, and Messi 19/20 is #5.
Josip Iličić 18/19 ranks #7 (1.16), Michael Olise 24/25 ranks #9 (1.19), Messi 15/16 ranks #11 (1.25),
Neymar 16/17 ranks #13 (1.34), and Leroy Sané 23/24 ranks #24 (1.58). Dribbling and take-on metrics,
which Messi and Yamal share most strongly, account for the difference in Messi 15/16's exact position.

Rerun the audit lever with `python pipeline/scripts/audit_reel.py`.

## Running the Pipeline

```bash
cd pipeline
uv sync
uv run twin build            # all models; or: uv run twin build understat
uv run twin show understat "Lamine Yamal" 2025/26
uv run pytest
```

Output goes to `web/public/data/*.json` and `data/snapshot.json`.

## Running and Deploying the App

```bash
cd web
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static export in web/out
```

**Vercel standalone.** Import the repo and set Root Directory to `web`. Static JSON files in
`web/public/data/` serve as the dataset, so Vercel never runs the pipeline.

**Under aryamantepal.com/statistical-twin.** Build with `NEXT_PUBLIC_BASE_PATH=/statistical-twin`
as a Vercel environment variable.

## License

MIT. See LICENSE. Data belongs to its respective owners.
