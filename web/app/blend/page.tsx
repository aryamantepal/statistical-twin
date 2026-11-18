import type { Metadata } from "next";
import BlendApp from "@/components/BlendApp";

export const metadata: Metadata = {
  title: "Player blender · Statistical Twin",
  description: "Blend two player-seasons, nudge the profile, and find the closest real season.",
};

export default function Page() {
  return <BlendApp />;
}
