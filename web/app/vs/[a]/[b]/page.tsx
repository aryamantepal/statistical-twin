import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VsApp from "@/components/VsApp";
import { label, shortSeason } from "@/lib/data";
import { core, prerenderedPairs } from "@/lib/server-data";
import { ordinal, pairStats, vsPath } from "@/lib/vs";

export const dynamicParams = false;

type Props = { params: Promise<{ a: string; b: string }> };

export function generateStaticParams() {
  return prerenderedPairs();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { a, b } = await params;
  const { data: d, bySlug } = core();
  const i = bySlug.get(a);
  const j = bySlug.get(b);
  if (i === undefined || j === undefined) return {};
  const { distance, rankAB, rankBA } = pairStats(d, i, j);
  const title = `${d.player[i]} ${shortSeason(d.season[i])} vs ${d.player[j]} ${shortSeason(d.season[j])}: statistical twins`;
  const ranks =
    rankAB !== null && rankBA !== null
      ? ` ${d.player[j]} is ${d.player[i]}’s ${ordinal(rankAB)} closest twin; ${d.player[i]} is ${d.player[j]}’s ${ordinal(rankBA)}.`
      : "";
  const description =
    `${label(d, i)} (${d.team[i]}) and ${label(d, j)} (${d.team[j]}) are ${distance.toFixed(2)} apart ` +
    `across 13 per-90 stats.${ranks}`;
  const url = vsPath(a, b);
  // Setting openGraph here replaces the parent's file-convention image, so point at the shared card explicitly.
  const image = { url: "/vs/opengraph-image", width: 1200, height: 630, alt: "A head-to-head comparison of two statistical twins" };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "Statistical Twin", title, description, url, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page({ params }: Props) {
  const { a, b } = await params;
  const { bySlug } = core();
  if (!bySlug.has(a) || !bySlug.has(b)) notFound();
  return <VsApp />;
}
