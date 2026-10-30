"""Tiny cached HTTP helper: every fetch lands on disk once and is reused."""

import json
import time
from pathlib import Path

import httpx

from twin.config import CACHE_DIR

USER_AGENT = "statistical-twin/0.1 (+https://github.com/aryamantepal/statistical-twin)"


def cached_get(url: str, path: Path, *, headers: dict | None = None, delay: float = 0.0) -> bytes:
    path = CACHE_DIR / path
    if path.exists():
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            r = httpx.get(
                url,
                headers={"User-Agent": USER_AGENT, **(headers or {})},
                follow_redirects=True,
                timeout=60,
            )
            r.raise_for_status()
            break
        except httpx.HTTPError:
            if attempt == 3:
                raise
            time.sleep(2**attempt)
    path.write_bytes(r.content)
    time.sleep(delay)
    return r.content


def cached_json(url: str, path: Path, **kwargs):
    return json.loads(cached_get(url, path, **kwargs))
