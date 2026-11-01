"use client";

import { useEffect, useRef, useState } from "react";

/** A canvas sized to its container width (at device pixel ratio), redrawn when `draw` changes. */
export function useCanvas(
  height: (width: number) => number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = width ? height(width) : 0;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = h * dpr;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    draw(ctx, width, h);
  }, [draw, width, h]);

  return { ref };
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Changes whenever the colour scheme does (OS setting or the picker), so canvases repaint. */
export function useSchemeKey(): string {
  const [key, setKey] = useState("");
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setKey(`${root.dataset.scheme ?? ""}:${mq.matches}`);
    update();
    mq.addEventListener("change", update);
    const mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ["data-scheme"] });
    return () => {
      mq.removeEventListener("change", update);
      mo.disconnect();
    };
  }, []);
  return key;
}
