import { type Dataset, basePath, distancesFrom, rankFrom } from "./data";

/** Canonical /vs path for two slugs: the alphabetically smaller slug first, so A/B and B/A are one page. */
export function vsPath(a: string, b: string, model = "core"): string {
  const [x, y] = a <= b ? [a, b] : [b, a];
  return `/vs/${x}/${y}${model === "core" ? "" : `?m=${encodeURIComponent(model)}`}`;
}

export function vsHref(a: string, b: string, model = "core"): string {
  return `${basePath}${vsPath(a, b, model)}`;
}

export type PairStats = {
  distance: number;
  /** Rank of b among a's twins (1 = nearest), or null when a and b are seasons of the same player. */
  rankAB: number | null;
  rankBA: number | null;
};

/** Rank of j in i's twin list: read from the stored neighbours when present, else counted from scratch. */
function rankIn(d: Dataset, i: number, j: number): number | null {
  if (d.id[i] === d.id[j]) return null;
  for (let r = 0; r < d.k; r++) if (d.nn[i * d.k + r] === j) return r + 1;
  return rankFrom(d, i, distancesFrom(d, i), j);
}

export function pairStats(d: Dataset, a: number, b: number): PairStats {
  let s = 0;
  for (let c = 0; c < d.m; c++) {
    const diff = d.z[a * d.m + c] - d.z[b * d.m + c];
    s += diff * diff;
  }
  return { distance: Math.sqrt(s), rankAB: rankIn(d, a, b), rankBA: rankIn(d, b, a) };
}

/** The stats where two seasons sit closest together and the one where they differ most, in z units. */
export function metricGaps(d: Dataset, a: number, b: number, closest = 2): { closest: string[]; biggest: string } {
  const gaps = d.metrics
    .map((metric, c) => ({ label: metric.label, gap: Math.abs(d.z[a * d.m + c] - d.z[b * d.m + c]) }))
    .sort((x, y) => x.gap - y.gap);
  return { closest: gaps.slice(0, closest).map((g) => g.label), biggest: gaps[gaps.length - 1].label };
}

export function gapSentence(d: Dataset, a: number, b: number): string {
  const { closest, biggest } = metricGaps(d, a, b);
  return `Closest on ${closest.join(" and ")}; furthest apart on ${biggest}.`;
}

export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n.toLocaleString("en-US")}${suffix}`;
}
