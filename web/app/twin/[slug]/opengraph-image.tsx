import { OG_SIZE, twinCard } from "@/lib/og-card";
import { core, prerenderedSlugs } from "@/lib/server-data";

export const alt = "A player-season and its nearest statistical twin";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return prerenderedSlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data, bySlug } = core();
  return twinCard(data, bySlug.get(slug)!);
}
