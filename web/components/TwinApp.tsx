"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type Dataset,
  type ModelInfo,
  findByName,
  findSeason,
  label,
  loadManifest,
  loadModel,
  moreIsolated,
  neighboursOf,
} from "@/lib/data";
import DotPlot from "./DotPlot";
import MapView from "./MapView";
import Search from "./Search";

const DEFAULT = { model: "core", player: "Lamine Yamal", season: "2023/24" };

type Selection = { subject: number; twin: number | null };

type Carry = { id: string | null; player: string | null; season: string | null };

function initialSelection(d: Dataset, { id, player, season }: Carry): Selection {
  let subject = findSeason(d, id, season);
  if (subject < 0 && player && season) subject = findByName(d, player, season);
  if (subject < 0) subject = findByName(d, DEFAULT.player, DEFAULT.season);
  if (subject < 0) subject = 0;
  return { subject, twin: d.nn[subject * d.k] };
}

export default function TwinApp() {
  const [manifest, setManifest] = useState<ModelInfo[]>([]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [view, setView] = useState<"map" | "radial">("radial");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a model, then select the carried player-season (matched by name when ids differ).
  const open = useCallback((key: string, carry: Carry) => {
    loadModel(key).then(
      (d) => {
        setModelKey(key);
        setData(d);
        setSel(initialSelection(d, carry));
      },
      (e) => setError(String(e)),
    );
  }, []);

  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
    const q = new URLSearchParams(window.location.search);
    open(q.get("m") ?? DEFAULT.model, { id: q.get("id"), player: null, season: q.get("s") });
  }, [open]);

  useEffect(() => {
    if (!data || !sel || !modelKey) return;
    const q = new URLSearchParams({ m: modelKey, id: data.id[sel.subject], s: data.season[sel.subject] });
    window.history.replaceState(null, "", `?${q}`);
  }, [data, sel, modelKey]);

  const switchModel = (key: string) => {
    if (!data || !sel) return open(key, { id: null, player: null, season: null });
    const i = sel.subject;
    open(key, { id: data.id[i], player: data.player[i], season: data.season[i] });
  };

  const pickSubject = (i: number) => {
    if (!data) return;
    setSel({ subject: i, twin: data.nn[i * data.k] });
    setShowAll(false);
  };
  const pickTwin = (i: number) => sel && setSel({ ...sel, twin: i === sel.subject ? sel.twin : i });

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Statistical Twin</h1>
          <p>
            Every big-five-league season with 1,500+ minutes, described by per-90 percentiles, and its
            nearest neighbours in that space.
          </p>
        </div>
        {manifest.length > 0 && (
          <div className="tabs" role="group" aria-label="Model">
            {manifest.map((m) => (
              <button key={m.key} aria-pressed={m.key === modelKey} onClick={() => switchModel(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </header>
      {data && <p className="model-note">{data.info.description}</p>}

      {error && <p className="loading">Couldn’t load data: {error}</p>}
      {!data || !sel ? (
        !error && <p className="loading">Loading player-seasons…</p>
      ) : (
        <Body
          data={data}
          sel={sel}
          view={view}
          setView={setView}
          showAll={showAll}
          setShowAll={setShowAll}
          pickSubject={pickSubject}
          pickTwin={pickTwin}
        />
      )}

      <footer className="notes">
        <div>
          <h3>Method</h3>
          <ul>
            <li>Each metric is per 90 (or a rate), turned into a percentile within its league-season.</li>
            <li>
              Percentiles become normal scores, Φ⁻¹(percentile), and are standardised; distance is plain
              Euclidean across all metrics.
            </li>
            <li>A player’s own other seasons are excluded from their twins and from the isolation count.</li>
            <li>
              Map: x = creator metrics minus finisher metrics, y = mean percentile, dot size = minutes. Radial:
              radius is the true distance; direction comes from the map.
            </li>
          </ul>
        </div>
        <div>
          <h3>Data</h3>
          <ul>
            <li>
              <a href="https://understat.com">Understat</a>: goals, xG, shots, assists, xA, key passes, xGChain,
              xGBuildup.
            </li>
            <li>
              <a href="https://fbref.com">FBref</a> (Opta) via the{" "}
              <a href="https://github.com/JaseZiv/worldfootballR_data">worldfootballR_data</a> mirror: dribbles,
              final-third passes, fouls won, shots on target.
            </li>
            <li>
              <a href="https://github.com/statsbomb/open-data">StatsBomb open data</a>: the same four for 2015/16.
            </li>
          </ul>
          {data && data.log.length > 0 && (
            <details>
              <summary>Data gaps in this model ({data.log.length})</summary>
              <pre>{data.log.join("\n")}</pre>
            </details>
          )}
          <p>
            <a href="https://github.com/aryamantepal/statistical-twin">Source on GitHub</a> · inspired by
            Kickonomics.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Body({
  data,
  sel,
  view,
  setView,
  showAll,
  setShowAll,
  pickSubject,
  pickTwin,
}: {
  data: Dataset;
  sel: Selection;
  view: "map" | "radial";
  setView: (v: "map" | "radial") => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  pickSubject: (i: number) => void;
  pickTwin: (i: number) => void;
}) {
  const s = sel.subject;
  const twins = neighboursOf(data, s);
  const shown = showAll ? twins : twins.slice(0, 10);
  const maxD = twins[twins.length - 1]?.distance || 1;
  const nearer = moreIsolated(data, s);

  return (
    <>
      <Search data={data} onPick={pickSubject} />

      <section className="hero">
        <div className="card who">
          <h2>{label(data, s)}</h2>
          <p>
            {data.team[s]} · {data.leagues[data.league[s]]} · {data.minutes[s].toLocaleString()} minutes
          </p>
        </div>
        <div className="card tile">
          <div className="label">Nearest twin</div>
          <div className="value">{twins[0].distance.toFixed(2)}</div>
          <div className="detail">{label(data, twins[0].index)}</div>
        </div>
        <div className="card tile">
          <div className="label">Seasons within d = {data.radius}</div>
          <div className="value">{data.iso[s].toLocaleString()}</div>
          <div className="detail">
            Median season: {Math.round(data.medianIsolation).toLocaleString()} · {nearer.toLocaleString()} of{" "}
            {data.n.toLocaleString()} are more isolated
          </div>
        </div>
        <div className="card tile">
          <div className="label">Typical distance</div>
          <div className="value">{data.typical[s].toFixed(1)}</div>
          <div className="detail">Median distance to every other season</div>
        </div>
      </section>

      <section className="grid2">
        <div className="card">
          <h2>Twins</h2>
          <p className="sub">Closest seasons by other players. Click one to compare.</p>
          <ol className="twins">
            {shown.map((t, r) => (
              <li key={t.index}>
                <button aria-pressed={t.index === sel.twin} onClick={() => pickTwin(t.index)}>
                  <span className="rank">#{r + 1}</span>
                  <span className="name">
                    {label(data, t.index)}
                    <small>
                      {data.team[t.index]} · {data.leagues[data.league[t.index]]}
                    </small>
                  </span>
                  <span className="dist">
                    <span className="bar" style={{ width: `${(t.distance / maxD) * 48}px` }} />
                    {t.distance.toFixed(2)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {!showAll && twins.length > 10 && (
            <button className="more" onClick={() => setShowAll(true)}>
              Show top {twins.length}
            </button>
          )}
        </div>
        <div className="card">
          <div className="section-head">
            <div>
              <h2>Percentile profile</h2>
              <p className="sub">Within league-season, 1,500+ minute players. Hover a row for raw values.</p>
            </div>
            {sel.twin !== null && (
              <button className="more" onClick={() => pickSubject(sel.twin!)}>
                Find {data.player[sel.twin]}’s twins →
              </button>
            )}
          </div>
          <DotPlot data={data} a={s} b={sel.twin} />
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="section-head">
          <div>
            <h2>{view === "radial" ? `Distance from ${label(data, s)}` : "The map"}</h2>
            <p className="sub">
              {view === "radial"
                ? "Rings at d = 2, 4, 6, 8. Brighter = closer. Up = more star, right = more creator."
                : `All ${data.n.toLocaleString()} seasons. Highlighted: the top 10 twins. Dot size = minutes.`}{" "}
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
        <MapView data={data} subject={s} twin={sel.twin} mode={view} onPick={pickTwin} />
      </section>
    </>
  );
}
