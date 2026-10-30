"""Z-scoring, Euclidean nearest neighbours, isolation and 2D map coordinates."""

from dataclasses import dataclass

import numpy as np


def zscore(x: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Column-wise z-scores (population std). Returns (z, mean, std)."""
    x = np.asarray(x, dtype=float)
    mean = x.mean(axis=0)
    std = x.std(axis=0)
    std = np.where(std > 0, std, 1.0)
    return (x - mean) / std, mean, std


def distances(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Euclidean distance between every row of a and every row of b."""
    sq = (a * a).sum(1)[:, None] + (b * b).sum(1)[None, :] - 2 * a @ b.T
    return np.sqrt(np.maximum(sq, 0))


@dataclass
class Neighbours:
    index: np.ndarray  # (n, k) row indices of nearest other-player seasons
    distance: np.ndarray  # (n, k)
    isolation: np.ndarray  # (n,) other-player seasons within `radius`
    typical: np.ndarray  # (n,) median distance to all other-player seasons


def neighbours(
    z: np.ndarray, player: np.ndarray, k: int, radius: float, chunk: int = 1024
) -> Neighbours:
    """Top-k neighbours per row, ignoring rows that belong to the same player.

    A player's other seasons are excluded everywhere: they would otherwise crowd the top of
    every list, and the reel's isolation count excludes them too.
    """
    n = len(z)
    player = np.asarray(player)
    # Cap k so every row has k other-player seasons; otherwise excluded (inf) rows leak in.
    k = min(k, n - np.unique(player, return_counts=True)[1].max())
    idx = np.empty((n, k), dtype=np.int64)
    dist = np.empty((n, k))
    iso = np.empty(n, dtype=np.int64)
    typical = np.empty(n)
    for start in range(0, n, chunk):
        stop = min(start + chunk, n)
        d = distances(z[start:stop], z)
        d[player[start:stop, None] == player[None, :]] = np.inf
        part = np.argpartition(d, k - 1, axis=1)[:, :k]
        pd_ = np.take_along_axis(d, part, axis=1)
        order = np.argsort(pd_, axis=1, kind="stable")
        idx[start:stop] = np.take_along_axis(part, order, axis=1)
        dist[start:stop] = np.take_along_axis(pd_, order, axis=1)
        iso[start:stop] = (d <= radius).sum(axis=1)
        d[np.isinf(d)] = np.nan
        typical[start:stop] = np.nanmedian(d, axis=1)
    return Neighbours(idx, dist, iso, typical)


def map_axes(
    z: np.ndarray, pct: np.ndarray, axis_sign: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Composite map coordinates.

    x: mean z of creator metrics minus mean z of finisher metrics (finishers left,
       creators right).
    y: mean percentile across all metrics, i.e. how elite the season is overall ("stars"
       at the top).
    """
    axis_sign = np.asarray(axis_sign)
    creators, finishers = axis_sign > 0, axis_sign < 0
    x = z[:, creators].mean(1) - z[:, finishers].mean(1)
    y = pct.mean(1)
    return x, y
