"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type Dataset, distancesFrom, label } from "@/lib/data";
import { cssVar, useCanvas, useColorScheme } from "./useCanvas";

type Props = {
  data: Dataset;
  subject: number;
  twin: number | null;
  mode: "map" | "radial";
  onPick: (i: number) => void;
};

const PAD = { l: 34, r: 16, t: 16, b: 34 };
const RINGS = [2, 4, 6, 8];
const MAX_D = 10;

export default function MapView({ data, subject, twin, mode, onPick }: Props) {
  const scheme = useColorScheme();
  const pos = useRef<{ x: Float32Array; y: Float32Array; visible: Uint8Array } | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const dist = useMemo(() => distancesFrom(data, subject), [data, subject]);
  const top = useMemo(() => new Set(Array.from(data.nn.subarray(subject * data.k, subject * data.k + 10))), [data, subject]);
  const bounds = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < data.n; i++) {
      x0 = Math.min(x0, data.x[i]); x1 = Math.max(x1, data.x[i]);
      y0 = Math.min(y0, data.y[i]); y1 = Math.max(y1, data.y[i]);
    }
    return { x0, x1, y0, y1 };
  }, [data]);
  const maxMin = useMemo(() => data.minutes.reduce((a, b) => Math.max(a, b), 0), [data]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      void scheme; // redraw on theme change
      const dot = cssVar("--dot");
      const glow = cssVar("--glow");
      const subjectColor = cssVar("--subject");
      const twinColor = cssVar("--twin");
      const text2 = cssVar("--text-2");
      const text3 = cssVar("--text-3");
      const border = cssVar("--border");
      const surface = cssVar("--surface");
      const px = new Float32Array(data.n);
      const py = new Float32Array(data.n);
      const visible = new Uint8Array(data.n);
      const size = (i: number) => 1.2 + 2.6 * Math.max(0, (data.minutes[i] - 1500) / (maxMin - 1500));
      ctx.font = "12px ui-sans-serif, system-ui, sans-serif";

      if (mode === "map") {
        const sx = (v: number) => PAD.l + ((v - bounds.x0) / (bounds.x1 - bounds.x0)) * (w - PAD.l - PAD.r);
        const sy = (v: number) => h - PAD.b - ((v - bounds.y0) / (bounds.y1 - bounds.y0)) * (h - PAD.t - PAD.b);
        for (let i = 0; i < data.n; i++) {
          px[i] = sx(data.x[i]);
          py[i] = sy(data.y[i]);
          visible[i] = 1;
        }
        // Axes
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx(0), PAD.t);
        ctx.lineTo(sx(0), h - PAD.b);
        ctx.stroke();
        ctx.fillStyle = text3;
        ctx.textAlign = "left";
        ctx.fillText("← Finishers", PAD.l, h - 10);
        ctx.textAlign = "right";
        ctx.fillText("Creators →", w - PAD.r, h - 10);
        ctx.save();
        ctx.translate(14, PAD.t);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "right";
        ctx.fillText("Stars ↑", 0, 0);
        ctx.restore();
        for (let i = 0; i < data.n; i++) {
          ctx.fillStyle = top.has(i) ? `rgba(${glow}, 0.9)` : `rgba(${dot}, 0.22)`;
          ctx.beginPath();
          ctx.arc(px[i], py[i], top.has(i) ? size(i) + 1.5 : size(i), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(w, h) / 2 - 18;
        // Direction comes from the map: up = more "star", right = more "creator".
        const ax = 1 / (bounds.x1 - bounds.x0);
        const ay = 1 / (bounds.y1 - bounds.y0);
        ctx.strokeStyle = border;
        ctx.fillStyle = text3;
        ctx.textAlign = "left";
        for (const r of RINGS) {
          ctx.beginPath();
          ctx.arc(cx, cy, (r / MAX_D) * R, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillText(`d = ${r}`, cx + 4, cy - (r / MAX_D) * R - 4);
        }
        const order = Array.from({ length: data.n }, (_, i) => i).sort((a, b) => dist[b] - dist[a]);
        for (const i of order) {
          if (i === subject || data.id[i] === data.id[subject]) continue;
          const d = dist[i];
          if (d > MAX_D) continue;
          let dx = (data.x[i] - data.x[subject]) * ax;
          let dy = (data.y[i] - data.y[subject]) * ay;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
          px[i] = cx + dx * (d / MAX_D) * R;
          py[i] = cy - dy * (d / MAX_D) * R;
          visible[i] = 1;
          const t = 1 - d / MAX_D;
          ctx.fillStyle = `rgba(${glow}, ${0.06 + 0.94 * t ** 3})`;
          ctx.beginPath();
          ctx.arc(px[i], py[i], size(i) * (0.7 + 0.6 * t), 0, Math.PI * 2);
          ctx.fill();
        }
        px[subject] = cx;
        py[subject] = cy;
        visible[subject] = 1;
      }

      // Highlighted marks with a surface ring, labelled directly.
      const mark = (i: number, color: string, r: number, below = false) => {
        ctx.fillStyle = color;
        ctx.strokeStyle = surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = text2;
        ctx.textAlign = px[i] > w - 140 ? "right" : "left";
        ctx.fillText(label(data, i), px[i] + (px[i] > w - 140 ? -10 : 10), py[i] + (below ? 18 : -8));
      };
      if (twin !== null && visible[twin]) mark(twin, twinColor, 6, true);
      mark(subject, subjectColor, 7);
      pos.current = { x: px, y: py, visible };
    },
    [data, subject, twin, mode, dist, top, bounds, maxMin, scheme],
  );

  const { ref: canvasRef } = useCanvas((w) => (mode === "map" ? Math.min(560, Math.max(320, w * 0.62)) : Math.min(620, w)), draw);

  const nearest = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = pos.current;
    if (!p) return null;
    let best = -1;
    let bestD = 10 * 10;
    for (let i = 0; i < data.n; i++) {
      if (!p.visible[i]) continue;
      const d = (p.x[i] - x) ** 2 + (p.y[i] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best < 0 ? null : { i: best, x, y };
  };

  return (
    <div className="viz">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={mode === "map" ? "Map of all player-seasons" : `Distance from ${label(data, subject)}`}
        onPointerMove={(e) => setHover(nearest(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = nearest(e);
          if (hit) onPick(hit.i);
        }}
      />
      {hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong>{label(data, hover.i)}</strong>
          <small>
            {data.team[hover.i]} · {data.minutes[hover.i].toLocaleString()} min
          </small>
          {hover.i !== subject && <small>d = {dist[hover.i].toFixed(2)} from {data.player[subject]}</small>}
        </div>
      )}
    </div>
  );
}
