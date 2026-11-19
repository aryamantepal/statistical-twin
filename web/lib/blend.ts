import { type Dataset, findByName, findSeason } from "./data";

/** A player-season carried across models: matched by id first, then by name. */
export type Pick = { id: string; player: string; season: string };

export type BlendState = {
  model: string;
  a: Pick | null;
  b: Pick | null;
  /** Percent weight on season A, 0–100. */
  weight: number;
  /** Per-metric additive nudges in z units, keyed by metric key. */
  nudges: Record<string, number>;
};

export const DEFAULT_BLEND: BlendState = {
  model: "core",
  a: { id: "447", player: "Kevin De Bruyne", season: "2017/18" },
  b: { id: "", player: "Lamine Yamal", season: "2025/26" },
  weight: 50,
  nudges: {},
};

export const NUDGE_RANGE = 2;

const round = (v: number, p: number) => Math.round(v * p) / p;

function encodePick(p: Pick): string {
  return [p.id, p.season, p.player].join("~");
}

function decodePick(s: string | null): Pick | null {
  if (!s) return null;
  const [id = "", season = "", ...rest] = s.split("~");
  const player = rest.join("~");
  return season && (player || id) ? { id, season, player } : null;
}

/** `?m=core&a=447~2017/18~Kevin De Bruyne&b=…&w=60&n=xa:0.5,npg:-0.3` */
export function encodeBlend(s: BlendState): string {
  const q = new URLSearchParams({ m: s.model });
  if (s.a) q.set("a", encodePick(s.a));
  if (s.b) q.set("b", encodePick(s.b));
  q.set("w", String(Math.round(s.weight)));
  const n = Object.entries(s.nudges)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}:${round(v, 10)}`);
  if (n.length) q.set("n", n.join(","));
  return q.toString();
}

export function decodeBlend(search: string): BlendState | null {
  const q = new URLSearchParams(search);
  const a = decodePick(q.get("a"));
  const b = decodePick(q.get("b"));
  if (!a && !b && !q.get("m")) return null;
  const w = Number(q.get("w") ?? 50);
  const nudges: Record<string, number> = {};
  for (const part of (q.get("n") ?? "").split(",")) {
    const [k, v] = part.split(":");
    const x = Number(v);
    if (k && Number.isFinite(x) && x !== 0) nudges[k] = Math.max(-NUDGE_RANGE, Math.min(NUDGE_RANGE, x));
  }
  return {
    model: q.get("m") ?? "core",
    a,
    b,
    weight: Number.isFinite(w) ? Math.max(0, Math.min(100, w)) : 50,
    nudges,
  };
}

export function resolvePick(d: Dataset, p: Pick | null): number {
  if (!p) return -1;
  const byId = p.id ? findSeason(d, p.id, p.season) : -1;
  return byId >= 0 ? byId : p.player ? findByName(d, p.player, p.season) : -1;
}

export function toPick(d: Dataset, i: number): Pick {
  return { id: d.id[i], player: d.player[i], season: d.season[i] };
}

/** The blended z-vector: w * z_a + (1 - w) * z_b, plus per-metric nudges. */
export function blendVector(d: Dataset, a: number, b: number, weight: number, nudges: Record<string, number>) {
  const w = weight / 100;
  const out = new Float32Array(d.m);
  for (let c = 0; c < d.m; c++) {
    out[c] = w * d.z[a * d.m + c] + (1 - w) * d.z[b * d.m + c] + (nudges[d.metrics[c].key] ?? 0);
  }
  return out;
}

/** Nearest real seasons to a profile (same Euclidean distance as `distancesFrom`), skipping the given players. */
export function nearestTo(d: Dataset, v: Float32Array, excludeIds: string[], limit = 10) {
  const { z, m } = d;
  const hits: { index: number; distance: number }[] = [];
  for (let j = 0; j < d.n; j++) {
    if (excludeIds.includes(d.id[j])) continue;
    let s = 0;
    const o = j * m;
    for (let c = 0; c < m; c++) {
      const diff = z[o + c] - v[c];
      s += diff * diff;
    }
    hits.push({ index: j, distance: Math.sqrt(s) });
  }
  return hits.sort((x, y) => x.distance - y.distance).slice(0, limit);
}
