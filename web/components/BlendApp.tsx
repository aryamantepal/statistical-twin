"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Dataset, type ModelInfo, basePath, label, loadManifest, loadModel, shortSeason } from "@/lib/data";
import {
  DEFAULT_BLEND,
  NUDGE_RANGE,
  type BlendState,
  blendVector,
  decodeBlend,
  encodeBlend,
  nearestTo,
  resolvePick,
  toPick,
} from "@/lib/blend";
import Search from "./Search";

function range(seasons: string[] | undefined): string {
  if (!seasons?.length) return "";
  return `${shortSeason(seasons[0])}–${shortSeason(seasons[seasons.length - 1])}`;
}

export default function BlendApp() {
  const acted = useRef(false);
  const [manifest, setManifest] = useState<ModelInfo[]>([]);
  const [data, setData] = useState<Dataset | null>(null);
  const [model, setModel] = useState(DEFAULT_BLEND.model);
  const [a, setA] = useState(-1);
  const [b, setB] = useState(-1);
  const [weight, setWeight] = useState(DEFAULT_BLEND.weight);
  const [nudges, setNudges] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((s: BlendState, fromSwitch = false) => {
    loadModel(s.model).then(
      (d) => {
        const ia = resolvePick(d, s.a);
        const ib = resolvePick(d, s.b);
        const lost = [
          s.a && ia < 0 ? `${s.a.player} ${s.a.season}` : null,
          s.b && ib < 0 ? `${s.b.player} ${s.b.season}` : null,
        ].filter(Boolean);
        setNotice(
          lost.length ? `${lost.join(" and ")} ${lost.length > 1 ? "aren’t" : "isn’t"} in ${d.info.label}. Pick another.` : null,
        );
        setModel(s.model);
        setData(d);
        setA(ia);
        setB(ib);
        setWeight(s.weight);
        // Keep only nudges for metrics this model has.
        const keys = new Set(d.metrics.map((m) => m.key));
        setNudges(Object.fromEntries(Object.entries(s.nudges).filter(([k]) => keys.has(k))));
        if (fromSwitch) acted.current = true;
      },
      (e) => setError(String(e)),
    );
  }, []);

  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
    open(decodeBlend(window.location.search) ?? DEFAULT_BLEND);
  }, [open]);

  const current = (): BlendState => ({
    model,
    a: data && a >= 0 ? toPick(data, a) : null,
    b: data && b >= 0 ? toPick(data, b) : null,
    weight,
    nudges,
  });

  // The URL is only rewritten after the user acts, so a fresh load keeps the address it arrived at.
  useEffect(() => {
    if (!data || !acted.current) return;
    const s: BlendState = {
      model,
      a: a >= 0 ? toPick(data, a) : null,
      b: b >= 0 ? toPick(data, b) : null,
      weight,
      nudges,
    };
    window.history.replaceState(null, "", `${basePath}/blend?${encodeBlend(s)}`);
  }, [data, model, a, b, weight, nudges]);

  const pickA = (i: number) => {
    acted.current = true;
    setA(i);
    setNotice(null);
  };
  const pickB = (i: number) => {
    acted.current = true;
    setB(i);
    setNotice(null);
  };
  const changeWeight = (v: number) => {
    acted.current = true;
    setWeight(v);
  };
  const setNudge = (key: string, v: number) => {
    acted.current = true;
    setNudges((n) => ({ ...n, [key]: v }));
  };
  const resetNudges = () => {
    acted.current = true;
    setNudges({});
  };

  const hits = useMemo(() => {
    if (!data || a < 0 || b < 0) return null;
    return nearestTo(data, blendVector(data, a, b, weight, nudges), [data.id[a], data.id[b]]);
  }, [data, a, b, weight, nudges]);

  const baseKey = manifest.find((m) => m.key === model)?.variantOf ?? model;
  const clVariant = manifest.find((m) => m.variantOf === baseKey);
  const switchModel = (key: string) => data && open({ ...current(), model: key }, true);
  const nudged = Object.values(nudges).some((v) => v !== 0);
  const maxD = hits?.[hits.length - 1]?.distance || 1;

  return (
    <main className="wrap">
      <nav className="top">
        <a className="wordmark" href={`${basePath}/`}>
          statistical twin
        </a>
        {manifest.length > 0 && (
          <div className="tabs" role="group" aria-label="Model">
            {manifest
              .filter((m) => !m.variantOf)
              .map((m) => (
                <button key={m.key} aria-pressed={m.key === baseKey} onClick={() => switchModel(m.key)}>
                  {m.label}
                  <small>{range(m.seasons)}</small>
                </button>
              ))}
          </div>
        )}
      </nav>

      <section className="intro">
        <span className="ov">Player blender</span>
        <h1>Blend two seasons, find the real one.</h1>
        <p className="lede">
          Mix two player-seasons by weight, nudge any stat, and see which real season sits closest to the result.
        </p>
        {data && (
          <div style={{ marginTop: 24 }}>
            {clVariant && (
              <div className="tabs comp" role="group" aria-label="Competitions" style={{ marginTop: 0, marginBottom: 14 }}>
                <button aria-pressed={model === baseKey} onClick={() => switchModel(baseKey)}>
                  League
                </button>
                <button aria-pressed={model === clVariant.key} onClick={() => switchModel(clVariant.key)}>
                  League + Champions League
                </button>
              </div>
            )}
            <p className="model-note" style={{ marginTop: 0 }}>
              {data.info.description}
            </p>
          </div>
        )}
      </section>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
        </div>
      )}
      {error && <p className="loading">Couldn’t load data: {error}</p>}
      {!data ? (
        !error && <p className="loading">Loading player-seasons…</p>
      ) : (
        <section className="grid2">
          <div className="card">
            <h3>Ingredients</h3>
            <p className="sub">Pick two seasons, then set how much of each goes in.</p>
            <div className="blend-picks">
              <div>
                <span className="ov">Season A · {weight}%</span>
                <Search data={data} onPick={pickA} compact id="blend-a" label="Season A" placeholder="Search season A…" />
                <p className="blend-pick">{a >= 0 ? label(data, a) : "None picked"}</p>
              </div>
              <div>
                <span className="ov">Season B · {100 - weight}%</span>
                <Search data={data} onPick={pickB} compact id="blend-b" label="Season B" placeholder="Search season B…" />
                <p className="blend-pick">{b >= 0 ? label(data, b) : "None picked"}</p>
              </div>
            </div>
            <label className="blend-slider">
              <span>
                Weight on A <b>{weight}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weight}
                onChange={(e) => changeWeight(Number(e.target.value))}
              />
            </label>
            <details className="blend-nudges" open={nudged || undefined}>
              <summary>Nudge individual stats{nudged ? " (adjusted)" : ""}</summary>
              <p className="sub">Shifts the blended profile, in standard deviations. Zero leaves it as is.</p>
              {data.metrics.map((mt) => (
                <label key={mt.key} className="blend-slider">
                  <span>
                    {mt.label} <b>{(nudges[mt.key] ?? 0).toFixed(1)}</b>
                  </span>
                  <input
                    type="range"
                    min={-NUDGE_RANGE}
                    max={NUDGE_RANGE}
                    step={0.1}
                    value={nudges[mt.key] ?? 0}
                    onChange={(e) => setNudge(mt.key, Number(e.target.value))}
                  />
                </label>
              ))}
              {nudged && (
                <button className="cta quiet" onClick={resetNudges}>
                  Reset nudges
                </button>
              )}
            </details>
          </div>

          <div className="card">
            <h3>Closest real seasons</h3>
            <p className="sub">Nearest to the blend, excluding every season by the two blended players.</p>
            {hits ? (
              <ol className="twins">
                {hits.map((h, r) => (
                  <li key={h.index}>
                    <a
                      className="blend-hit"
                      href={`${basePath}/?${new URLSearchParams({ m: model, id: data.id[h.index], p: data.player[h.index], s: data.season[h.index] })}`}
                    >
                      <span className="rank">{r + 1}</span>
                      <span className="name">
                        {label(data, h.index)}
                        <small>
                          {data.team[h.index]} · {data.leagues[data.league[h.index]]}
                        </small>
                      </span>
                      <span className="dist">
                        <span className="bar" style={{ width: `${(h.distance / maxD) * 44}px` }} />
                        {h.distance.toFixed(2)}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="loading">Pick two seasons to blend.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
