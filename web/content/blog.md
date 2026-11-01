---
title: "Rebuilding the statistical twin"
description: "Finding a footballer's most similar season with a nearest-neighbour model: the data hunt, the maths, and why my answer for Lamine Yamal isn't Messi."
date: "2026-11-01"
---

A Kickonomics reel asked a simple question: which past seasons look most like Lamine Yamal's? It turned 11,313 big-five-league seasons into 13 numbers each, measured the distance between every pair, and found that Yamal's nearest neighbour was Lionel Messi's 2015/16. That's a striking answer, and I wanted to check it, so I tried to rebuild the analysis with open data and publish the whole thing as an app anyone can poke at: [statistical-twin.vercel.app](https://statistical-twin.vercel.app).

My answer comes out differently. This post covers how the rebuild works, the places where it couldn't match the original, and what I think is going on.

## The idea

A "statistical twin" is the nearest point in a space where each season is a point.

1. **Pick the seasons.** Every big-five-league (Premier League, La Liga, Bundesliga, Serie A, Ligue 1) player-season with at least 1,500 league minutes.
2. **Describe each with 13 numbers.** Non-penalty goals, npxG, shots, xG per shot, assists, xA, key passes, chance involvement (xGChain), build-up involvement (xGBuildup), successful dribbles, dribble success %, final-third passes and fouls won. Everything is per 90 minutes except the two rates.
3. **Rank within the league-season.** A number only means something next to its peers, so each stat becomes a percentile among qualifying players in the same league and season. That puts a 2016 Serie A winger and a 2023 La Liga winger on the same footing.
4. **Measure distance.** Standardise each column, then take the straight-line (Euclidean) distance between two seasons across all 13. Small distance means a near-identical profile.

The reel added two views on top: a 2D map with finishers on the left, creators on the right and stars at the top, and an **isolation** score, the number of other seasons within distance 3.5. Few neighbours means nobody has played quite like you.

Note what this doesn't measure. Twins share a *profile*, not a level of quality. A mid-table winger who does everything at the 80th percentile can match a star who does the same things at the 80th percentile in a far better team.

## The data hunt

Understat was the easy part. Its league pages are fed by a JSON endpoint that returns every player's season totals: goals, xG, npxG, shots, assists, xA, key passes, xGChain and xGBuildup, back to 2014/15. That covers nine of the thirteen metrics.

The other four (dribbles attempted and completed, fouls won, final-third passes) are where it got hard.

- **FBref** has them, but it sits behind a bot challenge, and getting around that isn't something I wanted this project to do.
- **Sofascore**, the reel's cited source, returns 403s to scripts for the same reason.
- **worldfootballR_data** saved the project. The [worldfootballR](https://github.com/JaseZiv/worldfootballR) R package publishes pre-scraped FBref season tables as GitHub release assets. Possession (take-ons), passing (passes into the final third) and miscellaneous (fouls drawn) are complete for 2017/18 to 2023/24.
- **StatsBomb open data** filled 2015/16. StatsBomb released full event data for most of that big-five season. I streamed about 4 GB of match JSON once and reduced each match to a handful of per-player counts: dribble events and their outcomes, "Foul Won" events, and completed passes that start before x = 80 and end at or past it on StatsBomb's 120-long pitch. That last one matches FBref's definition of a pass into the final third, so both sources measure the same thing.

That left real holes, and I'd rather show them than paper over them:

- **No 2016/17.** No open source covers the four FBref stats for a full big-five season, so Neymar 16/17 is missing from the main model.
- **No Bundesliga 2015/16.** StatsBomb published only 34 Bundesliga matches that season, one club's fixtures. The pipeline checks each league-season's match count against `teams × (teams − 1)` and drops anything under 95%.
- **No 2024/25.** The mirror's possession and misc tables were last refreshed partway through the season. When I checked FBref directly, the take-on and fouls-drawn columns for 2024/25 are now there but empty: the site appears to have lost its Opta-sourced advanced stats. Partial-season totals would distort percentiles, so I left the season out.

The main model ends up with **8,903 seasons** against the reel's 11,313.

## Linking players across sources

Understat, FBref and StatsBomb share no player IDs, and names don't line up either: "Neymar" against "Neymar da Silva Santos Júnior", or Lee Kang-in written in Hangul. So I treated it as an assignment problem within each league-season. Every Understat player gets a score against every candidate from the other source:

```python
names = max(token_set_ratio, WRatio)       # 0–100, accents and punctuation folded
mins  = 1 − |Δminutes| / max(150, 10%)     # 1 when minutes agree, 0 at a big gap
teams = partial_ratio(team_a, team_b)      # 0–1
total = names + 40 * mins + 10 * teams
```

`scipy.optimize.linear_sum_assignment` (the Hungarian algorithm) finds the best one-to-one pairing, and a pair is accepted only if the name is a near-match, or a decent match backed by agreeing minutes. Minutes turn out to be the strongest signal: two sources rarely disagree about a player's season by more than a few percent.

The FBref mirror had its own quirk. A player's URL slug changes between tables (`/8f696594/Memphis` in one, `/8f696594/Memphis-Depay` in another), so joining on the URL quietly dropped Memphis, Raphinha and Gavi. Joining on the 8-character player ID fixed it.

In the end 7 of the roughly 8,900 qualifying seasons failed to link, and 7 more were dropped because the mirror is missing one table for them. The app lists every one under "Data gaps".

## What "z-score the percentiles" means

This step changed the results more than anything else.

The obvious reading is to take each percentile column (0–100) and standardise it. But percentiles are uniformly distributed by construction, and a standardised uniform variable is capped at ±1.73. The 100th-percentile dribbler and the 95th-percentile dribbler end up barely apart, which flattens exactly the outliers this analysis is about.

The other reading is to treat the percentile as a probability and convert it to a normal score, `Φ⁻¹((rank − ½) / n)`, before standardising:

```python
def normal_scores(values, groups):
    ranks = values.groupby(groups).rank(method="average")
    n = values.groupby(groups).transform("count")
    return norm.ppf((ranks - 0.5) / n)
```

Now the best player in a league-season sits about 2.7σ out instead of 1.73σ. That reading also comes closer to the reel's isolation figure: the median season has **2,391** neighbours within 3.5, or 27% of the universe, against the reel's 32%. The linear version gives 22%. I use normal scores by default, and `TWIN_ZSCORE=linear` switches back.

## Neighbours, isolation, and a subtle exclusion

Distances are computed in chunks of 1,024 rows against the whole matrix, which is quick at this size. One rule matters: **a player's own other seasons are excluded.** Without it, every great player's twin list would be their own adjacent seasons. Isolation excludes them too.

```python
d = distances(z[start:stop], z)
d[player[start:stop, None] == player[None, :]] = np.inf
```

A code review caught an edge case here. If `k` exceeds the number of *other* players' seasons, the excluded `inf` rows leak into the top-k, and `json.dumps` writes `Infinity`, which isn't valid JSON. That can't happen with real data, but `k` is now capped at `n − (max seasons per player)` and there's a test for it.

## The map

For the 2D view I chose composite axes over PCA or UMAP:

- **x** = mean z of the creator metrics (assists, xA, key passes, xGBuildup, dribbles, final-third passes) minus mean z of the finisher metrics (npG, npxG, shots, xG per shot).
- **y** = mean percentile across everything.

These are literally the reel's axes. They're deterministic, they keep their meaning when the data is rebuilt, and unlike PCA their sign can't flip between runs. UMAP would show tighter clusters, but its axes don't mean anything you could label.

![Every season on the composite axes, with Yamal's top ten twins highlighted](/blog/map.png)

The radial view puts one season at the centre. Radius is the true 13-dimensional distance, direction comes from the map (up means more elite, right means more creator), and rings sit at 2, 4, 6 and 8, with brighter dots closer.

![Distance from Lamine Yamal 2023/24](/blog/radial.png)

## Results, and why Messi isn't Yamal's twin here

| Check | Reel | This build |
|---|---|---|
| Seasons, 13-metric model | 11,313 | 8,903 |
| Seasons, since 2009 | 17,202 | 17,193 |
| Yamal 23/24's #1 | Messi 15/16 (3.06) | Kingsley Coman 19/20 (0.91) |
| Messi 15/16's #1 | Mbappé 21/22 | Florian Thauvin 17/18. Neymar 17/18 is #2, Iličić 18/19 #3, Mbappé 21/22 #7. |
| Median isolation | 32% | 27% |

**Messi 15/16 is not Yamal 23/24's twin in my data. It ranks 3,199th.** I think the reel's "Yamal 23/24" is really his 2024/25 season. In 2023/24 Yamal had 5 non-penalty goals and 5 assists in 2,186 La Liga minutes. That's 0.21 assists per 90, the 87th percentile, not the reel's 100th. His 2024/25 season matches the reel's numbers, including the 243 attempted dribbles.

I can't test 2024/25 with all 13 metrics. With only the nine Understat metrics, though, Yamal 24/25's neighbours look much like the reel's list: Sané 23/24 is #5, Messi 22/23 #7, Olise 24/25 #15 and Iličić 18/19 #17. Messi 15/16 is #103, but that model has no dribbling at all, which is the trait Messi and Yamal share most strongly.

![Comparing Yamal 2023/24 with his nearest twin](/blog/compare.png)

Two more differences are worth naming:

- **Final-third passes don't mean the same thing.** FBref counts completed passes *into* the final third, a progression stat. Sofascore's figure is probably passes *in* the final third, which wingers dominate. Yamal sits at the 28th percentile on FBref's version against 99th in the reel.
- **The distance scale is different.** The reel's nearest distance is 3.06 and its typical distance 12.3. A typical distance of 12.3 across 13 standardised axes needs an average gap of about 3.4σ per axis, which is hard to square with the method as described. Rankings don't depend on the scale, but isolation counts within 3.5 do.

There's also an extended model back to 2009/10, the reel's "since 2009" run. Its universe size nearly matches (17,193 against 17,202), which suggests the reel built its universe the same way. Before 2016/17, though, FBref only carries goals, assists and shots on target per player, so that model has three metrics and can't tell Yamal from an ordinary attacker.

## Shipping it as a static site

There's no backend. The pipeline writes one columnar JSON file per model, with flat arrays instead of objects and numbers stored as scaled integers, about 1.3–1.8 MB gzipped each. The Next.js app is a static export on Vercel.

- **Precomputed in Python:** each season's top 25 twins, isolation count, typical distance and map coordinates.
- **Computed in the browser:** distances from the selected season to all ~9,000 others, a 13-dimensional loop that takes a few milliseconds. That's what drives the radial view and the "compare with any season" search, which tells you that, say, Messi 15/16 is 4.41 from Yamal 23/24 and the 3,207th-closest season.
- **Canvas for the clouds** and SVG for the dot plot. Canvas can't resolve CSS `color-mix()` tokens, so secondary inks are drawn as the base ink at an alpha, which keeps all four colour schemes in sync.

The Python side has unit tests for the parts that are easy to get subtly wrong: percentile ties, the normal-score transform, z-scoring a constant column, brute-force-checked distances, the own-season exclusion, chunking invariance and the StatsBomb aggregation. CI runs ruff, pytest, eslint, tsc and a production build on every PR.

## What I'd do next

- **Find an open source for 2024/25 dribbling and fouls-won data,** so the reel's actual Yamal season can be tested with all 13 metrics.
- **Add a passes-in-final-third measure from event data,** to match the reel's definition.
- **Weight the metrics.** Right now every stat counts equally, so four correlated shooting stats outvote one dribbling stat. A version that decorrelates the stats first (Mahalanobis distance, or PCA whitening) would be a fairer measure of "similar".

The code is on [GitHub](https://github.com/aryamantepal/statistical-twin), and the app is at [statistical-twin.vercel.app](https://statistical-twin.vercel.app). Credit for the idea goes to Kickonomics.
