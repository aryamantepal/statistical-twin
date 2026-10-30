"use client";

import { useMemo, useState } from "react";
import { type Dataset, search } from "@/lib/data";

export default function Search({ data, onPick }: { data: Dataset; onPick: (i: number) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => search(data, query), [data, query]);

  const pick = (i: number) => {
    onPick(i);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls="search-results"
        aria-label="Search player-seasons"
        placeholder={`Search ${data.n.toLocaleString()} player-seasons — e.g. "Messi 2015", "Saka"`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && hits[active] !== undefined) pick(hits[active]);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
      />
      {open && hits.length > 0 && (
        <ul id="search-results" role="listbox">
          {hits.map((i, k) => (
            <li
              key={i}
              role="option"
              aria-selected={k === active}
              onMouseEnter={() => setActive(k)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(i);
              }}
            >
              <span>
                {data.player[i]} <strong>{data.season[i]}</strong>
              </span>
              <span>
                {data.team[i]} · {data.leagues[data.league[i]]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
