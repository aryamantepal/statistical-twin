"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type Dataset,
  type ModelInfo,
  basePath,
  findByName,
  findSeason,
  formatValue,
  label,
  loadManifest,
  loadModel,
  shortSeason,
} from "@/lib/data";
import { slugsFor } from "@/lib/slug";
import { ordinal, pairStats, vsPath } from "@/lib/vs";
import DotPlot from "./DotPlot";

type Pair = { a: number; b: number };
type Carry = { id: string; player: string; season: string };

/** The slugs and model named by the address bar: /vs/<a>/<b>?m=<model>. */
function readUrl(): { a: string; b: string; model: string } | null {
  const path = window.location.pathname.slice(basePath.length);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "vs" || parts.length < 3) return null;
  return { a: parts[1], b: parts[2], model: new URLSearchParams(window.location.search).get("m") ?? "core" };
}

function range(seasons: string[] | undefined): string {
  if (!seasons?.length) return "";
  return `${shortSeason(seasons[0])}–${shortSeason(seasons[seasons.length - 1])}`;
}

function carry(d: Dataset, i: number): Carry {
  return { id: d.id[i], player: d.player[i], season: d.season[i] };
}

function resolve(d: Dataset, c: Carry): number {
  const i = findSeason(d, c.id, c.season);
  return i >= 0 ? i : findByName(d, c.player, c.season);
}

/** Canonical address for a pair in a model, keeping any colour scheme from the current URL. */
function canonicalUrl(d: Dataset, key: string, pair: Pair): string {
  const slugs = slugsFor(d);
  const url = new URL(`${basePath}${vsPath(slugs[pair.a], slugs[pair.b], key)}`, window.location.origin);
  const scheme = new URLSearchParams(window.location.search).get("scheme");
  if (scheme) url.searchParams.set("scheme", scheme);
  return url.pathname + url.search;
}

function twinHref(d: Dataset, key: string, i: number): string {
  if (key === "core") return `${basePath}/twin/${slugsFor(d)[i]}`;
  const q = new URLSearchParams({ m: key, id: d.id[i], p: d.player[i], s: d.season[i] });
  return `${basePath}/?${q}`;
}

/**
 * Head-to-head view of two player-seasons. It reads the pair from the address bar and loads the data
 * in the browser, so the same component serves prerendered pairs and the /vs fallback for the rest.
 */
export default function VsApp() {
  const [manifest, setManifest] = useState<ModelInfo[]>([]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
    const url = readUrl();
    loadModel(url?.model ?? "core").then(
      (d) => {
        if (!url) {
          setError("That comparison link isn’t valid.");
          return;
        }
        const slugs = slugsFor(d);
        const a = slugs.indexOf(url.a);
        const b = slugs.indexOf(url.b);
        if (a < 0 || b < 0) {
          setError(`One of those seasons isn’t in the ${d.info.label} model.`);
          return;
        }
        // Either order of a pair renders; settle on the canonical one so shared links match the prerendered page.
        const here = window.location.pathname + window.location.search;
        const canon = canonicalUrl(d, url.model, { a, b });
        const pair = slugs[a] <= slugs[b] ? { a, b } : { a: b, b: a };
        if (here !== canon) window.history.replaceState(null, "", canon);
        setModelKey(url.model);
        setData(d);
        setPair(pair);
      },
      (e) => setError(String(e)),
    );
  }, []);

  const switchModel = (key: string) => {
    if (!data || !pair || key === modelKey) return;
    const ca = carry(data, pair.a);
    const cb = carry(data, pair.b);
    loadModel(key).then(
      (d) => {
        const a = resolve(d, ca);
        const b = resolve(d, cb);
        if (a < 0 || b < 0) {
          const gone = [a < 0 ? `${ca.player} ${ca.season}` : null, b < 0 ? `${cb.player} ${cb.season}` : null];
          setNotice(`${gone.filter(Boolean).join(" and ")} isn’t in ${d.info.label}.`);
          return;
        }
        const next = { a, b };
        window.history.replaceState(null, "", canonicalUrl(d, key, next));
        setNotice(null);
        setModelKey(key);
        setData(d);
        setPair(next);
      },
      (e) => setError(String(e)),
    );
  };

  const baseKey = manifest.find((m) => m.key === modelKey)?.variantOf ?? modelKey;
  const clVariant = manifest.find((m) => m.variantOf === baseKey);

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

      {clVariant && baseKey && data && (
        <div className="tabs comp" role="group" aria-label="Competitions">
          <button aria-pressed={modelKey === baseKey} onClick={() => switchModel(baseKey)}>
            League
          </button>
          <button aria-pressed={modelKey === clVariant.key} onClick={() => switchModel(clVariant.key)}>
            League + Champions League
          </button>
        </div>
      )}

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <p className="loading">
          {error} <a href={`${basePath}/`}>Search for a season</a>.
        </p>
      )}
      {!error && (!data || !pair || !modelKey) && <p className="loading">Loading player-seasons…</p>}
      {data && pair && modelKey && <Versus data={data} model={modelKey} pair={pair} />}
    </main>
  );
}

function Versus({ data, model, pair }: { data: Dataset; model: string; pair: Pair }) {
  const { a, b } = pair;
  const stats = useMemo(() => pairStats(data, a, b), [data, a, b]);
  const others = data.n - data.id.filter((id) => id === data.id[a]).length;
  const otherB = data.n - data.id.filter((id) => id === data.id[b]).length;

  return (
    <>
      <section className="intro vs-intro">
        <span className="ov">Head to head</span>
        <h1>
          <span className="who-a">{data.player[a]}</span> <small>{data.season[a]}</small>
          <span className="vs-word"> vs </span>
          <span className="who-b">{data.player[b]}</span> <small>{data.season[b]}</small>
        </h1>
        <p className="lede">
          {data.team[a]} · {data.leagues[data.league[a]]} · {data.minutes[a].toLocaleString()} minutes, against{" "}
          {data.team[b]} · {data.leagues[data.league[b]]} · {data.minutes[b].toLocaleString()} minutes. Percentiles are
          within each season’s own league.
        </p>
      </section>

      <section className="facts three">
        <div className="fact">
          <span className="ov">Distance</span>
          <b>{stats.distance.toFixed(2)}</b>
          <p>Straight-line distance across {data.m} standardised stats. The median season is {data.typical[a].toFixed(1)} from {data.player[a]}.</p>
        </div>
        <div className="fact">
          <span className="ov">{data.player[b]}’s rank in {data.player[a]}’s twins</span>
          <b>{stats.rankAB === null ? "n/a" : ordinal(stats.rankAB)}</b>
          <p>
            {stats.rankAB === null
              ? "Seasons of the same player never count as twins."
              : `Closest of ${others.toLocaleString()} other seasons.`}
          </p>
        </div>
        <div className="fact">
          <span className="ov">{data.player[a]}’s rank in {data.player[b]}’s twins</span>
          <b>{stats.rankBA === null ? "n/a" : ordinal(stats.rankBA)}</b>
          <p>
            {stats.rankBA === null
              ? "Seasons of the same player never count as twins."
              : `Closest of ${otherB.toLocaleString()} other seasons.`}
          </p>
        </div>
      </section>

      <section className="card section">
        <div className="head">
          <div>
            <h3>Percentile profiles</h3>
            <p className="sub">Each stat ranked within its league and season. Hover a row for the raw numbers.</p>
          </div>
          <span className="actions">
            <a className="cta quiet" href={twinHref(data, model, a)}>
              {data.player[a]}’s twins <span className="arrow">→</span>
            </a>
            <a className="cta quiet" href={twinHref(data, model, b)}>
              {data.player[b]}’s twins <span className="arrow">→</span>
            </a>
          </span>
        </div>
        <DotPlot data={data} a={a} b={b} />
      </section>

      <section className="card section">
        <h3>Side by side</h3>
        <p className="sub">Per-90 values (or rates) and percentiles for every stat in the model.</p>
        <div className="tablewrap">
          <table className="sidebyside">
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col" className="a">
                  <i className="swatch" style={{ background: "var(--subject)" }} /> {label(data, a)}
                </th>
                <th scope="col" className="b">
                  <i className="swatch" style={{ background: "var(--twin)" }} /> {label(data, b)}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m, j) => (
                <tr key={m.key}>
                  <th scope="row">{m.label}</th>
                  {[a, b].map((i) => (
                    <td key={i}>
                      {formatValue(m.key, data.raw[i * data.m + j])}
                      <small>{Math.round(data.pct[i * data.m + j])}th pct</small>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
