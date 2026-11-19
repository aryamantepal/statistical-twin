import { OG_SIZE, vsCard } from "@/lib/og-card";

export const alt = "A head-to-head comparison of two statistical twins";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Image() {
  return vsCard();
}
