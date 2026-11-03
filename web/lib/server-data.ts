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
