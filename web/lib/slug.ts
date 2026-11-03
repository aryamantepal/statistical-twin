import { type Dataset, fold } from "./data";

function slugify(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * One URL slug per row, e.g. `lamine-yamal-2023-24`. Rows that would collide (same name and season)
 * get their team appended, and any that still collide get their player id. Deterministic for a given
 * dataset, so the server (static params) and the client (redirects, URL sync) agree.
 */
export function buildSlugs(d: Pick<Dataset, "n" | "player" | "season" | "team" | "id">): string[] {
  const base = Array.from({ length: d.n }, (_, i) => `${slugify(d.player[i])}-${d.season[i].replace("/", "-")}`);
  const widen = (slugs: string[], extra: (i: number) => string) => {
    const count = new Map<string, number>();
    for (const s of slugs) count.set(s, (count.get(s) ?? 0) + 1);
    return slugs.map((s, i) => (count.get(s)! > 1 ? `${s}-${extra(i)}` : s));
  };
  const withTeam = widen(base, (i) => slugify(d.team[i]));
  return widen(withTeam, (i) => slugify(d.id[i]));
}

const cache = new WeakMap<object, string[]>();

export function slugsFor(d: Dataset): string[] {
  if (!cache.has(d)) cache.set(d, buildSlugs(d));
  return cache.get(d)!;
}
