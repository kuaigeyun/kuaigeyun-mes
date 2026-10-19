"""Render architecture.png from architecture.html via Playwright.

Prefer editing architecture.html (CSS vars --fs-* / --pad), then:

  python docs/screenshots/system/render_architecture.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MJS = HERE / "render_architecture.mjs"
NODE_MODULES = ROOT / "riveredge-frontend" / "node_modules"


def main() -> None:
    if not (NODE_MODULES / "playwright").is_dir():
        raise SystemExit(
            "缺少 playwright：请先在 riveredge-frontend 执行 npm install"
        )
    r = subprocess.run(
        ["node", str(MJS)],
        cwd=str(ROOT),
        check=False,
    )
    raise SystemExit(r.returncode)


if __name__ == "__main__":
    main()
