import { type Dataset, basePath, label, shortSeason } from "@/lib/data";
import { slugsFor } from "@/lib/slug";

export type HookRef = { row: number; player: string; team: string; season: string };
export type HookSection = {
  radius: number;
  isolated: (HookRef & { isolation: number })[];
  lead?: { subject: HookRef; twin: HookRef; distance: number; rank: number };
};
export type HooksDoc = Record<string, HookSection>;

export async function loadHooks(): Promise<HooksDoc> {
  const res = await fetch(`${basePath}/data/hooks.json`);
  return res.json();
}

/** Core results have a prerendered /twin/<slug> page; other models open on the app with the season selected. */
function href(data: Dataset, i: number): string {
  if (data.info.key === "core") return `${basePath}/twin/${slugsFor(data)[i]}`;
  const q = new URLSearchParams({ m: data.info.key, id: data.id[i], p: data.player[i], s: data.season[i] });
  return `${basePath}/?${q}`;
}

export default function Hooks({ data, section }: { data: Dataset; section: HookSection | undefined }) {
  if (!section) return null;
  const { lead, isolated } = section;
  return (
    <section className="hooks" aria-label="Highlights">
      {lead && (
        <a className="hook-lead" href={href(data, lead.subject.row)}>
          <span className="ov">Headline twin</span>
          <b>
            {label(data, lead.subject.row)} <span aria-hidden>↔</span> {lead.twin.player} {shortSeason(lead.twin.season)}
          </b>
          <span className="hook-meta">
            distance {lead.distance.toFixed(2)} · #{lead.rank} nearest for {lead.subject.player}
          </span>
        </a>
      )}
      <div className="hook-iso">
        <span className="ov">Most isolated attacking seasons</span>
        <ol>
          {isolated.map((h) => (
            <li key={h.row}>
              <a href={href(data, h.row)}>
                <span>
                  {h.player} {shortSeason(h.season)}
                </span>
                <small>
                  {h.isolation.toLocaleString()} within {section.radius}
                </small>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
