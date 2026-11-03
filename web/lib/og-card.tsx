import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { type Dataset, shortSeason } from "./data";

export const OG_SIZE = { width: 1200, height: 630 };

// Paper scheme from globals.css, as hex (Satori has no oklch).
const C = {
  bg: "#f9f4ee",
  paper: "#fdf9f4",
  ink: "#171f2e",
  ink2: "#4a505c",
  ink3: "#7f838b",
  rule: "#dedad4",
  subject: "#1f53b8",
  twin: "#d23f18",
};

const font = (f: string) => readFileSync(join(process.cwd(), "assets", f));
type Fonts = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;
let fonts: Fonts | undefined;
function loadFonts() {
  fonts ??= [
    { name: "Fraunces", data: font("fraunces-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Fraunces", data: font("fraunces-latin-ext-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Fraunces", data: font("fraunces-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Fraunces", data: font("fraunces-latin-ext-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Instrument Sans", data: font("instrument-sans-latin-500-normal.woff"), weight: 500, style: "normal" },
    { name: "Instrument Sans", data: font("instrument-sans-latin-400-normal.woff"), weight: 400, style: "normal" },
  ];
  return fonts;
}

const serif = "Fraunces";
const sans = "Instrument Sans";

/** Shorter label for the card's dot-plot rows: drop the parenthetical. */
const short = (l: string) => l.replace(/ \(.*\)$/, "");

function Overline({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", fontFamily: sans, fontWeight: 500, fontSize: 18, letterSpacing: 3, color: C.ink3 }}>
      {children.toUpperCase()}
    </div>
  );
}

/** Mini percentile dot-plot: two series on a shared 0–100 axis, built from absolutely positioned divs. */
function Dots({ d, a, b }: { d: Dataset; a: number; b: number }) {
  const LABEL = 200;
  const TRACK = 360;
  const ROW = 36;
  const dot = (p: number, color: string, size: number) => (
    <div
      style={{
        position: "absolute",
        left: (p / 100) * TRACK - size / 2,
        top: (ROW - size) / 2,
        width: size,
        height: size,
        borderRadius: size,
        background: color,
        border: `2px solid ${C.paper}`,
      }}
    />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {d.metrics.map((m, j) => {
        const pa = d.pct[a * d.m + j];
        const pb = d.pct[b * d.m + j];
        const lo = Math.min(pa, pb);
        return (
          <div key={m.key} style={{ display: "flex", alignItems: "center", height: ROW }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                width: LABEL,
                paddingRight: 16,
                fontFamily: sans,
                fontSize: 18,
                color: C.ink2,
              }}
            >
              {short(m.label)}
            </div>
            <div style={{ display: "flex", position: "relative", width: TRACK, height: ROW }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: ROW / 2, height: 1, background: C.rule }} />
              <div
                style={{
                  position: "absolute",
                  left: (lo / 100) * TRACK,
                  width: (Math.abs(pa - pb) / 100) * TRACK,
                  top: ROW / 2 - 1,
                  height: 3,
                  background: C.ink3,
                  opacity: 0.5,
                }}
              />
              {dot(pb, C.twin, 18)}
              {dot(pa, C.subject, 18)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function twinCard(d: Dataset, s: number): ImageResponse {
  const t = d.nn[s * d.k];
  const dist = d.nnd[s * d.k];
  const nameSize = d.player[s].length > 22 ? 52 : 64;
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: C.bg,
          color: C.ink,
          padding: "52px 56px",
          fontFamily: serif,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 440, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Overline>Statistical twin</Overline>
            <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
              <div style={{ width: 14, height: 14, borderRadius: 14, background: C.subject, marginRight: 12 }} />
              <div style={{ display: "flex", fontFamily: sans, fontSize: 22, color: C.ink2 }}>
                {`${shortSeason(d.season[s])} · ${d.team[s]}`}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: nameSize, fontWeight: 600, lineHeight: 1.05, marginTop: 8 }}>
              {d.player[s]}
            </div>
            <div style={{ display: "flex", fontFamily: sans, fontSize: 22, color: C.ink3, marginTop: 28 }}>
              nearest twin
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 14, background: C.twin, marginRight: 12 }} />
              <div style={{ display: "flex", fontFamily: sans, fontSize: 22, color: C.ink2 }}>
                {`${shortSeason(d.season[t])} · ${d.team[t]}`}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: d.player[t].length > 22 ? 40 : 48, fontWeight: 600, lineHeight: 1.05, marginTop: 8 }}>
              {d.player[t]}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ display: "flex", fontSize: 76, fontWeight: 600, lineHeight: 1 }}>{dist.toFixed(2)}</div>
              <div style={{ display: "flex", fontFamily: sans, fontSize: 22, color: C.ink3, marginLeft: 14 }}>apart</div>
            </div>
            <div style={{ display: "flex", fontFamily: sans, fontSize: 22, color: C.ink2, marginTop: 14 }}>
              {`${d.iso[s].toLocaleString("en-US")} neighbors, median ${Math.round(d.medianIsolation).toLocaleString("en-US")}`}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginLeft: 24,
            background: C.paper,
            border: `1px solid ${C.rule}`,
            borderRadius: 16,
            padding: "24px 0 0 0",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Dots d={d} a={s} b={t} />
          <div style={{ display: "flex", fontFamily: sans, fontSize: 16, color: C.ink3, marginTop: 6 }}>
            Percentile within league and season
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() },
  );
}

export function homeCard(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: C.bg,
          color: C.ink,
          padding: "64px 72px",
          fontFamily: serif,
        }}
      >
        <Overline>Big-five leagues · seasons of 1,500+ minutes</Overline>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 600, lineHeight: 1.02 }}>Statistical Twin</div>
          <div style={{ display: "flex", fontFamily: sans, fontSize: 32, color: C.ink2, marginTop: 24, maxWidth: 900 }}>
            Find any player-season’s most statistically similar match across the big five leagues.
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ width: 28, height: 28, borderRadius: 28, background: C.subject }} />
          <div style={{ width: 28, height: 28, borderRadius: 28, background: C.twin, marginLeft: 12 }} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() },
  );
}
