import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], axes: ["opsz", "SOFT"], variable: "--font-display" });
const text = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-text" });

export const metadata: Metadata = {
  title: "Statistical Twin",
  description:
    "Find the most statistically similar big-five-league player-seasons with a nearest-neighbour model.",
};

// Apply the saved colour scheme before first paint so the page never flashes the default.
const schemeScript = `try{var s=new URLSearchParams(location.search).get("scheme")||localStorage.getItem("scheme");if(s)document.documentElement.dataset.scheme=s}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: schemeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
