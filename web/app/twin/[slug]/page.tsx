import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TwinApp from "@/components/TwinApp";
import { label, shortSeason } from "@/lib/data";
import { core, prerenderedSlugs } from "@/lib/server-data";

export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return prerenderedSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: d, bySlug } = core();
  const s = bySlug.get(slug);
  if (s === undefined) return {};
  const t = d.nn[s * d.k];
  const title = `${d.player[s]} ${shortSeason(d.season[s])}’s statistical twin: ${d.player[t]} ${shortSeason(d.season[t])}`;
  const description =
    `${label(d, s)} (${d.team[s]}) and ${label(d, t)} (${d.team[t]}) are ${d.nnd[s * d.k].toFixed(2)} apart, ` +
    `the closest match among ${d.n.toLocaleString("en-US")} big-five-league seasons. ` +
    `${d.iso[s].toLocaleString("en-US")} neighbors within ${d.radius}, median ${Math.round(d.medianIsolation).toLocaleString("en-US")}.`;
  const url = `/twin/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "Statistical Twin", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { data: d, bySlug } = core();
  const s = bySlug.get(slug);
  if (s === undefined) notFound();
  // Only the selection goes to the client; the page fetches the shared JSON itself.
  return <TwinApp initial={{ model: "core", id: d.id[s], player: d.player[s], season: d.season[s] }} />;
}
