import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Dataset, type RawDoc, decode } from "./data";
import { buildSlugs } from "./slug";

export type CoreIndex = { data: Dataset; slugs: string[]; bySlug: Map<string, number> };

let cached: CoreIndex | null = null;

/** The core model, read from the committed JSON at build time. Never sent to the client. */
export function core(): CoreIndex {
  if (!cached) {
    const raw = readFileSync(join(process.cwd(), "public", "data", "core.json"), "utf8");
    const data = decode(JSON.parse(raw) as RawDoc);
    const slugs = buildSlugs(data);
    cached = { data, slugs, bySlug: new Map(slugs.map((s, i) => [s, i])) };
  }
  return cached;
}

/**
 * Rows that get a prerendered page and card. All of them unless TWIN_PAGE_LIMIT is set, in which case
 * only the first N most-minutes seasons (a cheap way to keep CI builds short).
 */
export function prerenderedSlugs(): string[] {
  const { data, slugs } = core();
  const limit = Number(process.env.TWIN_PAGE_LIMIT ?? 0);
  if (!limit) return slugs;
  const order = Array.from({ length: data.n }, (_, i) => i).sort((a, b) => data.minutes[b] - data.minutes[a]);
  return order.slice(0, limit).map((i) => slugs[i]);
}

/**
 * Canonical /vs pairs to prerender: each season's top-10 twins, deduped so A/B and B/A are one page
 * (the alphabetically smaller slug first, matching `vsPath`). Every other pair is served by the
 * client-side fallback on /vs.
 */
// Pairs prerendered regardless of rank, so their links unfurl with a per-pair title.
// Yamal 25/26 vs Messi 15/16 is the reel's comparison (5th in Yamal's twin list).
const FEATURED_PAIRS: [string, string][] = [["lamine-yamal-2025-26", "lionel-messi-2015-16"]];

export function prerenderedPairs(top = 3): { a: string; b: string }[] {
  const { data, slugs } = core();
  const subjects = new Set(prerenderedSlugs());
  const seen = new Set<string>();
  const out: { a: string; b: string }[] = [];
  for (let i = 0; i < data.n; i++) {
    if (!subjects.has(slugs[i])) continue;
    for (let r = 0; r < top; r++) {
      const j = data.nn[i * data.k + r];
      const [a, b] = slugs[i] <= slugs[j] ? [slugs[i], slugs[j]] : [slugs[j], slugs[i]];
      const key = `${a}/${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a, b });
    }
  }
  const known = new Set(slugs);
  for (const pair of FEATURED_PAIRS) {
    const [a, b] = [...pair].sort();
    if (!known.has(a) || !known.has(b) || seen.has(`${a}/${b}`)) continue;
    seen.add(`${a}/${b}`);
    out.push({ a, b });
  }
  return out;
}
