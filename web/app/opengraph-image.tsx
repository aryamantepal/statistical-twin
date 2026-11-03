import { OG_SIZE, homeCard } from "@/lib/og-card";

export const alt = "Statistical Twin: find any player-season’s statistical twin";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return homeCard();
}
