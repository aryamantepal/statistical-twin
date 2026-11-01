"use client";

import { useEffect, useState } from "react";

const SCHEMES = [
  { key: "paper", label: "Paper", subject: "oklch(47% 0.17 262)", twin: "oklch(58% 0.19 35)" },
  { key: "pitch", label: "Pitch", subject: "oklch(47% 0.11 165)", twin: "oklch(66% 0.15 65)" },
  { key: "clay", label: "Clay", subject: "oklch(50% 0.11 230)", twin: "oklch(56% 0.16 38)" },
  { key: "night", label: "Night", subject: "oklch(66% 0.14 248)", twin: "oklch(66% 0.17 42)" },
];

/** Colour-scheme switcher; the choice is kept per browser. */
export default function SchemePicker() {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setCurrent(root.dataset.scheme ?? null);
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["data-scheme"] });
    return () => mo.disconnect();
  }, []);

  const pick = (key: string) => {
    document.documentElement.setAttribute("data-scheme", key);
    try {
      localStorage.setItem("scheme", key);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this visit.
    }
  };

  return (
    <div className="schemes" role="group" aria-label="Colour scheme">
      {SCHEMES.map((s) => (
        <button key={s.key} aria-pressed={current === s.key} onClick={() => pick(s.key)}>
          <span className="pair" aria-hidden="true">
            <i style={{ background: s.subject }} />
            <i style={{ background: s.twin }} />
          </span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
