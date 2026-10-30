export type Metric = { key: string; label: string; source: string };

export type ModelInfo = { key: string; label: string; description: string };

type RawDoc = {
  model: ModelInfo;
  metrics: Metric[];
  leagues: Record<string, string>;
  radius: number;
  medianIsolation: number;
  log: string[];
  rows: {
    id: string[];
    player: string[];
    team: string[];
    league: string[];
    season: string[];
    minutes: number[];
    pct: number[];
    raw: number[];
    z: number[];
    x: number[];
    y: number[];
    iso: number[];
    typical: number[];
    nn: number[];
    nnd: number[];
  };
};

/** A model's universe with flat typed arrays; row i's metric j lives at i * m + j. */
export type Dataset = {
  info: ModelInfo;
  metrics: Metric[];
  leagues: Record<string, string>;
  radius: number;
  medianIsolation: number;
  log: string[];
  n: number;
  m: number;
  k: number;
  id: string[];
  player: string[];
  team: string[];
  league: string[];
  season: string[];
  minutes: Int32Array;
  pct: Float32Array; // 0–100
  raw: Float32Array; // per-90 or rate
  z: Float32Array;
  x: Float32Array;
  y: Float32Array;
  iso: Int32Array;
  typical: Float32Array;
  nn: Int32Array;
  nnd: Float32Array;
  /** Number of seasons with strictly fewer neighbours, indexed by isolation count. */
  isoSorted: Int32Array;
  searchKey: string[];
};

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function loadManifest(): Promise<ModelInfo[]> {
  const res = await fetch(`${basePath}/data/manifest.json`);
  return res.json();
}

const cache = new Map<string, Promise<Dataset>>();

export function loadModel(key: string): Promise<Dataset> {
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`${basePath}/data/${key}.json`)
        .then((r) => r.json() as Promise<RawDoc>)
        .then(decode),
    );
  }
  return cache.get(key)!;
}

export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/ß/g, "ss")
    .replace(/ł/g, "l")
    .toLowerCase();
}

function decode(doc: RawDoc): Dataset {
  const r = doc.rows;
  const n = r.id.length;
  const m = doc.metrics.length;
  const iso = Int32Array.from(r.iso);
  const isoSorted = Int32Array.from(iso).sort();
  return {
    info: doc.model,
    metrics: doc.metrics,
    leagues: doc.leagues,
    radius: doc.radius,
    medianIsolation: doc.medianIsolation,
    log: doc.log,
    n,
    m,
    k: r.nn.length / n,
    id: r.id,
    player: r.player,
    team: r.team,
    league: r.league,
    season: r.season,
    minutes: Int32Array.from(r.minutes),
    pct: Float32Array.from(r.pct, (v) => v / 10),
    raw: Float32Array.from(r.raw, (v) => v / 1000),
    z: Float32Array.from(r.z, (v) => v / 100),
    x: Float32Array.from(r.x),
    y: Float32Array.from(r.y),
    iso,
    typical: Float32Array.from(r.typical),
    nn: Int32Array.from(r.nn),
    nnd: Float32Array.from(r.nnd),
    isoSorted,
    searchKey: r.player.map((p, i) => fold(`${p} ${r.season[i]} ${r.team[i]}`)),
  };
}

/** Seasons with strictly fewer neighbours within the radius than row i. */
export function moreIsolated(d: Dataset, i: number): number {
  const target = d.iso[i];
  let lo = 0;
  let hi = d.isoSorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d.isoSorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Euclidean distance from row i to every row, in the model's z space. */
export function distancesFrom(d: Dataset, i: number): Float32Array {
  const out = new Float32Array(d.n);
  const { z, m } = d;
  const base = i * m;
  for (let j = 0; j < d.n; j++) {
    let s = 0;
    const o = j * m;
    for (let c = 0; c < m; c++) {
      const diff = z[o + c] - z[base + c];
      s += diff * diff;
    }
    out[j] = Math.sqrt(s);
  }
  return out;
}

export function neighboursOf(d: Dataset, i: number): { index: number; distance: number }[] {
  return Array.from({ length: d.k }, (_, r) => ({
    index: d.nn[i * d.k + r],
    distance: d.nnd[i * d.k + r],
  }));
}

export function search(d: Dataset, query: string, limit = 12): number[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: number[] = [];
  for (let i = 0; i < d.n && hits.length < 400; i++) {
    const key = d.searchKey[i];
    if (terms.every((t) => key.includes(t))) hits.push(i);
  }
  // Group by player name, newest season first.
  hits.sort((a, b) => d.player[a].localeCompare(d.player[b]) || d.season[b].localeCompare(d.season[a]));
  return hits.slice(0, limit);
}

export function findSeason(d: Dataset, id: string | null, season: string | null): number {
  if (id && season) {
    for (let i = 0; i < d.n; i++) if (d.id[i] === id && d.season[i] === season) return i;
  }
  return -1;
}

export function findByName(d: Dataset, name: string, season: string): number {
  const f = fold(name);
  for (let i = 0; i < d.n; i++) if (fold(d.player[i]) === f && d.season[i] === season) return i;
  return -1;
}

export function formatValue(metric: string, v: number): string {
  if (metric === "dribble_pct") return `${v.toFixed(0)}%`;
  if (metric === "xg_per_shot") return v.toFixed(2);
  return `${v.toFixed(2)} /90`;
}

export function label(d: Dataset, i: number): string {
  return `${d.player[i]} ${d.season[i]}`;
}
