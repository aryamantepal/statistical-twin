import numpy as np
import pytest

from twin.model import distances, map_axes, neighbours, zscore


def test_zscore_standardises_columns():
    x = np.array([[0.0, 10.0], [50.0, 10.0], [100.0, 10.0]])
    z, mean, std = zscore(x)
    assert mean.tolist() == [50.0, 10.0]
    assert np.allclose(z[:, 0], [-1.2247449, 0.0, 1.2247449])
    assert np.allclose(z.mean(0), 0) and np.allclose(z[:, 0].std(), 1)
    # A constant column has zero spread: it maps to 0 rather than NaN.
    assert np.all(z[:, 1] == 0) and std[1] == 1.0


def test_distances_match_bruteforce():
    rng = np.random.default_rng(0)
    a, b = rng.normal(size=(5, 13)), rng.normal(size=(7, 13))
    brute = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(-1))
    assert np.allclose(distances(a, b), brute)
    assert distances(np.array([[0.0, 0.0]]), np.array([[3.0, 4.0]]))[0, 0] == pytest.approx(5)


def test_neighbours_exclude_same_player_and_count_isolation():
    # Rows 0 and 1 are the same player; row 2 is 1 away, row 3 is 3 away, row 4 is 10 away.
    z = np.array([[0.0], [0.1], [1.0], [3.0], [10.0]])
    player = np.array(["a", "a", "b", "c", "d"])
    nb = neighbours(z, player, k=3, radius=3.5, chunk=2)
    assert nb.index[0].tolist() == [2, 3, 4]
    assert nb.distance[0].tolist() == [1.0, 3.0, 10.0]
    # Row 0 has rows 2 and 3 within 3.5; its own other season (row 1) is not counted.
    assert nb.isolation[0] == 2
    assert nb.isolation[4] == 0
    assert nb.typical[0] == 3.0  # median of 1, 3, 10


def test_neighbours_chunking_is_invariant():
    rng = np.random.default_rng(1)
    z = rng.normal(size=(50, 4))
    player = np.arange(50) // 2
    a = neighbours(z, player, k=5, radius=2.0, chunk=7)
    b = neighbours(z, player, k=5, radius=2.0, chunk=1000)
    assert np.array_equal(a.index, b.index) and np.array_equal(a.isolation, b.isolation)


def test_map_axes_finisher_creator_and_stars():
    z = np.array([[2.0, -2.0, 0.0], [-2.0, 2.0, 0.0]])
    pct = np.array([[90.0, 10.0, 50.0], [10.0, 90.0, 50.0]])
    x, y = map_axes(z, pct, axis_sign=[-1, 1, 0])  # metric 0 = finishing, 1 = creating
    assert x.tolist() == [-4.0, 4.0]  # finisher left, creator right
    assert y.tolist() == [50.0, 50.0]


def test_neighbours_cap_k_so_own_seasons_never_leak_in():
    z = np.array([[0.0], [0.1], [0.2], [5.0]])
    player = np.array(["a", "a", "a", "b"])
    nb = neighbours(z, player, k=3, radius=1.0)
    assert nb.index.shape[1] == 1
    assert np.isfinite(nb.distance).all()
