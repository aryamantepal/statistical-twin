"use client";

import { useState } from "react";
import { basePath } from "@/lib/data";

type Props = {
  /** Path of the page being shared, e.g. "/twin/lamine-yamal-2025-26". */
  path: string;
  /** Prefilled post text. */
  text: string;
  /** Path of the result card PNG; omit when the page has no card. */
  card?: { href: string; filename: string };
};

export default function ShareRow({ path, text, card }: Props) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${basePath}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url());
    }
  };

  const post = () => {
    const q = new URLSearchParams({ text, url: url() });
    window.open(`https://x.com/intent/post?${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="share" role="group" aria-label="Share this result">
      <span className="ov">Share</span>
      <button className="cta quiet" onClick={copy}>
        {copied ? "Link copied" : "Copy link"}
      </button>
      <button className="cta quiet" onClick={post}>
        Post on X
      </button>
      {card && (
        <a className="cta quiet" href={`${basePath}${card.href}`} download={card.filename}>
          Download card (PNG)
        </a>
      )}
    </div>
  );
}
