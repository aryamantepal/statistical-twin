import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Statistical Twin",
  description:
    "Find the most statistically similar big-five-league player-seasons with a nearest-neighbour model.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
