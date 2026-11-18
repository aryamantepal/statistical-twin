"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Dataset,
  type ModelInfo,
  basePath,
  distancesFrom,
  findByName,
  findSeason,
  followingSeasons,
  label,
  loadManifest,
  loadModel,
  isolationFrom,
  moreIsolated,
  nearestFrom,
  neighboursOf,
  positionLabel,
  rankFrom,
  shortSeason,
  withinPosition,
} from "@/lib/data";
import { slugsFor } from "@/lib/slug";
import { ordinal, vsHref } from "@/lib/vs";
import DotPlot from "./DotPlot";
import Hooks, { type HooksDoc, loadHooks } from "./Hooks";
import MapView from "./MapView";
import SchemePicker from "./SchemePicker";
import Search from "./Search";
import ShareRow from "./ShareRow";

const DEFAULT = { model: "core", player: "Lamine Yamal", season: "2025/26" };

type Selection = { subject: number; twin: number | null };
type Carry = { id: string | null; player: string | null; season: string | null };
/** A requested player-season the current model doesn't have. */
type Missing = { player: string | null; season: string; model: string };

function initialSelection(d: Dataset, { id, player, season }: Carry): { sel: Selection; found: boolean } {
  // A fresh model always starts on overall twins; the within-position switch resets with it.
  let subject = findSeason(d, id, season);
  if (subject < 0 && player && season) subject = findByName(d, player, season);
  const found = subject >= 0;
  if (!found) subject = findByName(d, DEFAULT.player, DEFAULT.season);
  if (subject < 0) subject = 0;
  return { sel: { subject, twin: d.nn[subject * d.k] }, found };
}

function range(seasons: string[] | undefined): string {
  if (!seasons?.length) return "";
  return `${shortSeason(seasons[0])}–${shortSeason(seasons[seasons.length - 1])}`;
}

/** The selection a prerendered /twin/<slug> page starts on, resolved at build time. */
export type Initial = { model: string; id: string; player: string; season: string };

export default function TwinApp({ initial }: { initial?: Initial }) {
  const router = useRouter();
  // URL is only rewritten after the user acts, so a fresh page load keeps the address it arrived at.
  const acted = useRef(false);
  const [manifest, setManifest] = useState<ModelInfo[]>([]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [missing, setMissing] = useState<Missing | null>(null);
  const [view, setView] = useState<"map" | "radial">("radial");
  const [showAll, setShowAll] = useState(false);
  const [within, setWithin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<HooksDoc | null>(null);

  // Load a model, then select the carried player-season (matched by name when ids differ).
  const open = useCallback((key: string, carry: Carry, legacyLink = false) => {
    loadModel(key).then(
      (d) => {
        const { sel, found } = initialSelection(d, carry);
        if (legacyLink && found && key === "core") {
          // Old ?id=&p=&s= link: static export has no redirects, so move to the prerendered path.
          const scheme = new URLSearchParams(window.location.search).get("scheme");
          router.replace(`/twin/${slugsFor(d)[sel.subject]}${scheme ? `?scheme=${encodeURIComponent(scheme)}` : ""}`);
          return;
        }
        setModelKey(key);
        setWithin(false);
        setData(d);
        setSel(sel);
        setMissing(!found && carry.season ? { player: carry.player, season: carry.season, model: d.info.label } : null);
      },
      (e) => setError(String(e)),
    );
  }, [router]);

  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
    loadHooks().then(setHooks, () => {});
    if (initial) {
      open(initial.model, { id: initial.id, player: initial.player, season: initial.season });
      return;
    }
    const q = new URLSearchParams(window.location.search);
    const carry = { id: q.get("id"), player: q.get("p"), season: q.get("s") };
    open(q.get("m") ?? DEFAULT.model, carry, Boolean(carry.id || carry.player));
  }, [open, initial]);

  useEffect(() => {
    if (!data || !sel || !modelKey || !acted.current) return;
    const i = sel.subject;
    const scheme = new URLSearchParams(window.location.search).get("scheme");
    if (modelKey === "core") {
      // Core results have a prerendered, shareable path.
      const q = scheme ? `?scheme=${encodeURIComponent(scheme)}` : "";
      window.history.replaceState(null, "", `${basePath}/twin/${slugsFor(data)[i]}${q}`);
      return;
    }
    const q = new URLSearchParams({ m: modelKey, id: data.id[i], p: data.player[i], s: data.season[i] });
    if (scheme) q.set("scheme", scheme);
    window.history.replaceState(null, "", `${basePath}/?${q}`);
  }, [data, sel, modelKey]);

  const switchModel = (key: string, carry?: Carry) => {
    acted.current = true;
    if (carry) return open(key, carry);
    if (!data || !sel) return open(key, { id: null, player: null, season: null });
    const i = sel.subject;
    open(key, { id: data.id[i], player: data.player[i], season: data.season[i] });
  };

  const pickSubject = (i: number) => {
    if (!data) return;
    acted.current = true;
    const lens = within ? withinPosition(data) : data;
    setSel({ subject: i, twin: within ? nearestFrom(lens, i, distancesFrom(lens, i))[0].index : data.nn[i * data.k] });
    setMissing(null);
    setShowAll(false);
  };
  // Switching lens re-ranks the twins, so the compared season restarts at the new nearest twin.
  const switchLens = (next: boolean) => {
    if (!data || !sel) return;
    setWithin(next);
    const lens = next ? withinPosition(data) : data;
    setSel({ ...sel, twin: next ? nearestFrom(lens, sel.subject, distancesFrom(lens, sel.subject))[0].index : data.nn[sel.subject * data.k] });
    setShowAll(false);
  };
  const pickTwin = (i: number) => sel && i !== sel.subject && setSel({ ...sel, twin: i });

  const elsewhere = missing ? manifest.filter((m) => m.key !== modelKey && m.seasons?.includes(missing.season)) : [];
  // A model and its League + CL variant share one tab, with a switch between them.
  const baseKey = manifest.find((m) => m.key === modelKey)?.variantOf ?? modelKey;
  const clVariant = manifest.find((m) => m.variantOf === baseKey);

  return (
    <>
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
          <span className="ov">Big-five leagues · seasons of 1,500+ minutes</span>
          <h1>Find any season’s statistical twin.</h1>
          <p className="lede">
            Search a player-season. Every other season is ranked by how alike the two are across per-90 stats,
            each measured against its own league that year.
          </p>
          {data && (
            <div style={{ marginTop: 24 }}>
              <Search data={data} onPick={pickSubject} id="subject" />
              {clVariant && baseKey && (
                <div className="tabs comp" role="group" aria-label="Competitions">
                  <button aria-pressed={modelKey === baseKey} onClick={() => switchModel(baseKey)}>
                    League
                  </button>
                  <button aria-pressed={modelKey === clVariant.key} onClick={() => switchModel(clVariant.key)}>
                    League + Champions League
                  </button>
                </div>
              )}
              {data.zp && (
                <div className="tabs comp" role="group" aria-label="Twin comparison">
                  <button aria-pressed={!within} onClick={() => switchLens(false)}>
                    Overall twins
                  </button>
                  <button aria-pressed={within} onClick={() => switchLens(true)}>
                    Within position
                  </button>
                </div>
              )}
              <p className="model-note">{data.info.description}</p>
            </div>
          )}
        </section>

        {data && !initial && <Hooks data={data} section={hooks?.[data.info.key]} />}

        {missing && (
          <div className="notice" role="status">
            <span>
              <strong>
                {missing.player ? `${missing.player} ${missing.season}` : "That season"}
              </strong>{" "}
              isn’t in {missing.model}. Showing {DEFAULT.player} {DEFAULT.season} instead.
            </span>
            {elsewhere.length > 0 && (
              <span className="actions">
                {elsewhere.map((m) => (
                  <button
                    key={m.key}
                    className="cta quiet"
                    onClick={() => switchModel(m.key, { id: null, player: missing.player, season: missing.season })}
                  >
                    Open in {m.label} <span className="arrow">→</span>
                  </button>
                ))}
              </span>
            )}
          </div>
        )}

        {error && <p className="loading">Couldn’t load data: {error}</p>}
        {!data || !sel ? (
          !error && <p className="loading">Loading player-seasons…</p>
        ) : (
          <Body
            data={data}
            modelKey={modelKey!}
            sel={sel}
            view={view}
            setView={setView}
            within={within}
            showAll={showAll}
            setShowAll={setShowAll}
            pickSubject={pickSubject}
            pickTwin={pickTwin}
          />
        )}
      </main>

      <footer className="band">
        <div className="wrap">
          <span className="ov">How it works</span>
          <h2>Thirteen numbers per season, and the distance between them.</h2>
          <div className="cols">
            <div>
              <h4>Method</h4>
              <ul>
                <li>Each stat is per 90 minutes (or a rate), ranked as a percentile within its league and season.</li>
                <li>
                  Percentiles become normal scores and are standardised, so every stat counts equally. Distance is
                  straight-line distance across all of them.
                </li>
                <li>
                  Goalkeepers are left out. “Within position” re-standardises each stat inside each position group
                  (defenders, midfielders, forwards, and mixed-role seasons), so a defender is matched on how he
                  compares with other defenders.
                </li>
                <li>A player’s own other seasons never count as their twin, or towards isolation.</li>
                <li>Map: right = more creator, left = more finisher, up = elite across the board. Dot size = minutes.</li>
              </ul>
            </div>
            <div>
              <h4>Data</h4>
              <ul>
                <li>
                  <a href="https://understat.com">Understat</a>: goals, xG, shots, assists, xA, key passes, xGChain,
                  xGBuildup.
                </li>
                <li>
                  <a href="https://www.sofascore.com">Sofascore</a>: dribbles attempted and completed, final-third
                  passes, fouls won (2015/16 onward).
                </li>
                <li>
                  <a href="https://fbref.com">FBref</a> (Opta), via the{" "}
                  <a href="https://github.com/JaseZiv/worldfootballR_data">worldfootballR_data</a> mirror: goals,
                  assists and shots on target for the “Since 2009” model.
                </li>
                <li>
                  Positions come from Understat’s per-season role list, or FBref’s primary position in “Since 2009”.
                </li>
              </ul>
              {data && data.log.length > 0 && (
                <details>
                  <summary>Data gaps in this model ({data.log.length})</summary>
                  <pre>{data.log.join("\n")}</pre>
                </details>
              )}
            </div>
            <div>
              <h4>Colours</h4>
              <SchemePicker />
            </div>
          </div>
          <div className="legal">
            <span>Inspired by Kickonomics. Data © its owners.</span>
            <span className="legal-links">
              <a href="https://aryamantepal.com/projects/statistical-twin">Read the writeup</a>
              <a href="https://github.com/aryamantepal/statistical-twin">Source on GitHub</a>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}

function Body({
  data,
  modelKey,
  sel,
  view,
  setView,
  within,
  showAll,
  setShowAll,
  pickSubject,
  pickTwin,
}: {
  data: Dataset;
  modelKey: string;
  sel: Selection;
  view: "map" | "radial";
  setView: (v: "map" | "radial") => void;
  within: boolean;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  pickSubject: (i: number) => void;
  pickTwin: (i: number) => void;
}) {
  const s = sel.subject;
  const t = sel.twin;
  // The lens decides which z-scores distances are measured in; everything below reads `lens`.
  const lens = useMemo(() => (within ? withinPosition(data) : data), [data, within]);
  const dist = useMemo(() => distancesFrom(lens, s), [lens, s]);
  const twins = useMemo(() => (within ? nearestFrom(lens, s, dist) : neighboursOf(data, s)), [within, lens, data, s, dist]);
  const iso = useMemo(() => (within ? isolationFrom(lens, s, dist) : null), [within, lens, s, dist]);
  const shown = showAll ? twins : twins.slice(0, 10);
  const maxD = twins[twins.length - 1]?.distance || 1;
  const topTwins = useMemo(() => twins.slice(0, 10).map((t) => t.index), [twins]);
  const twinRank = useMemo(() => (t === null ? null : rankFrom(data, s, dist, t)), [data, s, dist, t]);
  const slugs = slugsFor(data);
  const others = useMemo(() => data.n - data.id.filter((id) => id === data.id[s]).length, [data, s]);

  return (
    <>
      <section className="facts">
        <div className="fact who">
          <span className="ov">Selected season</span>
          <h2>
            <i aria-hidden="true" />
            {data.player[s]} <span>{data.season[s]}</span>
          </h2>
          <p>
            {data.team[s]} · {data.leagues[data.league[s]]}
            {data.pos && ` · ${positionLabel(data.pos[s])}`} · {data.minutes[s].toLocaleString()} minutes
            {data.clMinutes && data.clMinutes[s] > 0 && ` (${data.clMinutes[s].toLocaleString()} in the Champions League)`}
          </p>
        </div>
        <div className="fact">
          <span className="ov">Nearest twin</span>
          <b>{twins[0].distance.toFixed(2)}</b>
          <p>{label(data, twins[0].index)}</p>
        </div>
        <div className="fact">
          <span className="ov">Seasons within {data.radius}</span>
          <b>{(iso ? iso.within : data.iso[s]).toLocaleString()}</b>
          <p>
            {iso
              ? "Other players’ seasons within that distance, in within-position scores."
              : `The median season has ${Math.round(data.medianIsolation).toLocaleString()}. ${moreIsolated(data, s).toLocaleString()} seasons are more isolated.`}
          </p>
        </div>
        <div className="fact">
          <span className="ov">Typical distance</span>
          <b>{(iso ? iso.typical : data.typical[s]).toFixed(1)}</b>
          <p>Median distance to every other season.</p>
        </div>
      </section>

      <ShareRow
        path={
          modelKey === "core"
            ? `/twin/${slugs[s]}`
            : `/?${new URLSearchParams({ m: modelKey, id: data.id[s], p: data.player[s], s: data.season[s] })}`
        }
        text={`${label(data, s)}’s statistical twin is ${label(data, twins[0].index)}, ${twins[0].distance.toFixed(2)} apart.`}
        card={modelKey === "core" ? { href: `/twin/${slugs[s]}/opengraph-image`, filename: `${slugs[s]}.png` } : undefined}
      />

      <section className="card next">
        <h3>What they did next</h3>
        <p className="sub">
          Each top twin’s following two seasons, with their distance from {data.player[s]} {data.season[s]}, and whether
          that season moved closer or further than the twin season itself.
        </p>
        <ol className="next-list">
          {twins.slice(0, 3).map((tw, r) => (
            <li key={tw.index}>
              <div className="next-who">
                <span className="rank">{r + 1}</span>
                <span className="name">
                  {label(data, tw.index)}
                  <small>{data.team[tw.index]}</small>
                </span>
              </div>
              <ul>
                {followingSeasons(data, tw.index, dist).map((n) => (
                  <li key={n.season}>
                    <span className="ov">{n.season}</span>
                    {n.row !== null && n.distance !== null ? (
                      <span>
                        {data.team[n.row]} · {data.minutes[n.row].toLocaleString()} min · <b>{n.distance.toFixed(2)}</b>{" "}
                        apart <em>{n.distance <= tw.distance ? "(closer)" : "(further)"}</em>
                      </span>
                    ) : (
                      <span className="none">
                        {n.future
                          ? "No season yet."
                          : "Not in the data (outside the big five leagues, or too few minutes)."}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid2">
        <div className="card">
          <h3>Twins</h3>
          <p className="sub">
            {within
              ? "The closest seasons by other players, once every stat is measured against players in the same position. Pick one to compare, or open the head-to-head page."
              : "The closest seasons by other players. Pick one to compare, or open the head-to-head page."}
          </p>
          <ol className="twins">
            {shown.map((tw, r) => (
              <li key={tw.index}>
                <button aria-pressed={tw.index === t} onClick={() => pickTwin(tw.index)}>
                  <span className="rank">{r + 1}</span>
                  <span className="name">
                    {label(data, tw.index)}
                    <small>
                      {data.team[tw.index]} · {data.leagues[data.league[tw.index]]}
                    </small>
                  </span>
                  <span className="dist">
                    <span className="bar" style={{ width: `${(tw.distance / maxD) * 44}px` }} />
                    {tw.distance.toFixed(2)}
                  </span>
                </button>
                <a className="vslink" href={vsHref(slugs[s], slugs[tw.index], modelKey)} aria-label={`${label(data, s)} vs ${label(data, tw.index)}`}>
                  vs
                </a>
              </li>
            ))}
          </ol>
          {!showAll && twins.length > 10 && (
            <button className="cta quiet more" onClick={() => setShowAll(true)}>
              Show top {twins.length}
            </button>
          )}
        </div>

        <div className="card">
          <div className="compare-head">
            <div className="head">
              <div>
                <h3>Compare</h3>
                <p className="sub" style={{ marginBottom: 0 }}>
                  Pick a twin, or search any other season.
                </p>
              </div>
              {t !== null && (
                <button className="cta quiet" onClick={() => pickSubject(t)}>
                  Find {data.player[t]}’s twins <span className="arrow">→</span>
                </button>
              )}
            </div>
            <Search
              data={data}
              onPick={(i) => {
                if (i !== s) window.location.assign(vsHref(slugs[s], slugs[i], modelKey));
              }}
              compact
              id="compare"
              label="Compare with another season"
              placeholder={`Compare ${data.player[s]} with…`}
            />
            {t !== null && twinRank !== null && (
              <div className="vs">
                <b>{dist[t].toFixed(2)}</b>
                <span>
                  apart. {data.player[t]} {data.season[t]} is the {ordinal(twinRank)} closest of{" "}
                  {others.toLocaleString()} seasons.
                </span>
              </div>
            )}
          </div>
          <DotPlot data={data} a={s} b={t} />
        </div>
      </section>

      <section className="card section">
        <div className="head">
          <div>
            <h3>{view === "radial" ? `Distance from ${label(data, s)}` : "Every season, mapped"}</h3>
            <p className="sub">
              {view === "radial"
                ? "Rings at 2, 4, 6 and 8. Brighter is closer. Up is more elite, right is more creator."
                : `All ${data.n.toLocaleString()} seasons. The top 10 twins are highlighted. Dot size is minutes.`}{" "}
              Click a dot to compare.
            </p>
          </div>
          <div className="tabs" role="group" aria-label="View">
            <button aria-pressed={view === "radial"} onClick={() => setView("radial")}>
              Radial
            </button>
            <button aria-pressed={view === "map"} onClick={() => setView("map")}>
              Map
            </button>
          </div>
        </div>
        <MapView data={data} subject={s} twin={t} mode={view} dist={dist} topTwins={topTwins} onPick={pickTwin} />
      </section>
    </>
  );
}
