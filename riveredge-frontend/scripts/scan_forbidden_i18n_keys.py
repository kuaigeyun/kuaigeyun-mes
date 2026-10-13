#!/usr/bin/env python3
"""守门：禁止引用 zh-CN 中不存在的 i18n key（当前仅 common.remarks）。

用法:
  python scripts/scan_forbidden_i18n_keys.py
  python scripts/scan_forbidden_i18n_keys.py --fail-on high
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
EXTS = {".ts", ".tsx"}
SKIP_DIRS = {"locales", "node_modules", "__snapshots__", "dist"}

# key → 应使用的真源 key
FORBIDDEN = {
    "common.remarks": "common.remark",
}

PATTERN = re.compile(
    r"""['"](common\.remarks)['"]"""
)


def iter_source_files() -> list[Path]:
    out: list[Path] = []
    for path in ROOT.rglob("*"):
        if path.suffix not in EXTS:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        out.append(path)
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on", choices=("high", "any"), default="any")
    args = parser.parse_args()

    hits: list[tuple[str, int, str, str]] = []
    for path in iter_source_files():
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        rel = path.relative_to(ROOT.parent).as_posix()
        for i, line in enumerate(text.splitlines(), 1):
            for m in PATTERN.finditer(line):
                bad = m.group(1)
                hits.append((rel, i, bad, FORBIDDEN[bad]))

    if not hits:
        print("scan_forbidden_i18n_keys: OK (0 hits)")
        return 0

    for rel, line_no, bad, use_instead in hits:
        print(f"{rel}:{line_no}: forbidden {bad!r} → use {use_instead!r}")

    print(f"scan_forbidden_i18n_keys: {len(hits)} hit(s)")
    if args.fail_on == "high" or hits:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
