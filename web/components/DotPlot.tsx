"use client";

import { useEffect, useRef, useState } from "react";
import { type Dataset, formatValue, label } from "@/lib/data";

const ROW = 28;
const RIGHT = 16;
const TOP = 22;

/** Percentile of each metric for the subject and one twin, on a shared 0–100 axis. */
export default function DotPlot({ data, a, b }: { data: Dataset; a: number; b: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(620);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width < 480;
  const LEFT = narrow ? 128 : 196;
  // On narrow screens drop the parenthetical, e.g. "Chance involvement (xGChain)" -> "Chance involvement".
  const metricLabel = (l: string) => (narrow ? l.replace(/ \(.*\)$/, "") : l);
  const height = TOP + data.m * ROW + 8;
  const sx = (p: number) => LEFT + (p / 100) * (width - LEFT - RIGHT);

  return (
    <div className="viz" ref={box}>
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: "var(--subject)" }} /> {label(data, a)}
        </span>
        {b !== null && (
          <span>
            <i className="swatch" style={{ background: "var(--twin)" }} /> {label(data, b)}
          </span>
        )}
      </div>
      <svg className="dotplot" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Percentile comparison">
        <g className="grid axis">
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={TOP - 6} y2={height - 8} />
              <text x={sx(t)} y={TOP - 10} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
        </g>
        {data.metrics.map((metric, j) => {
          const y = TOP + j * ROW + ROW / 2;
          const pa = data.pct[a * data.m + j];
          const pb = b === null ? null : data.pct[b * data.m + j];
          return (
            <g
              key={metric.key}
              className="row"
              onMouseEnter={() => setHover(j)}
              onMouseLeave={() => setHover(null)}
            >
              <rect className="hit" x={0} y={y - ROW / 2} width={width} height={ROW} fill="transparent" rx={4} />
              <text x={LEFT - 12} y={y + 4} textAnchor="end">
                {metricLabel(metric.label)}
              </text>
              {pb !== null && (
                <line x1={sx(pa)} x2={sx(pb)} y1={y} y2={y} stroke="var(--text-3)" strokeWidth={2} opacity={0.5} />
              )}
              {pb !== null && (
                <circle cx={sx(pb)} cy={y} r={6} fill="var(--twin)" stroke="var(--surface)" strokeWidth={2} />
              )}
              <circle cx={sx(pa)} cy={y} r={6} fill="var(--subject)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: narrow ? 0 : LEFT, top: TOP + hover * ROW + ROW / 2 + 52 }}>
          <strong>{data.metrics[hover].label}</strong>
          {[a, b].map(
            (i) =>
              i !== null && (
                <small key={i}>
                  {label(data, i)}: {formatValue(data.metrics[hover].key, data.raw[i * data.m + hover])} ·{" "}
                  {Math.round(data.pct[i * data.m + hover])}th pct
                </small>
              ),
          )}
          <small>Source: {data.metrics[hover].source}</small>
        </div>
      )}
    </div>
  );
}
