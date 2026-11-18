import type { Metadata } from "next";
import VsApp from "@/components/VsApp";

export const metadata: Metadata = {
  title: "Head to head · Statistical Twin",
  description: "Compare two player-seasons across 13 per-90 stats.",
  robots: { index: false },
};

/**
 * Serves every /vs/<a>/<b> pair that isn't prerendered: vercel.json rewrites those URLs here, and the
 * client reads the slugs from the address bar and loads the data in the browser.
 */
export default function Page() {
  return <VsApp />;
}
