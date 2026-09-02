#!/usr/bin/env python3
"""Replace Drawer / DetailDrawerTemplate / UniDetail `width=` with `size=` on opening tags."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
EXTS = {".ts", ".tsx", ".js", ".jsx"}
SKIP_PARTS = {"locales", "node_modules", "__snapshots__"}
TAGS = ("Drawer", "DetailDrawerTemplate", "UniDetail")


def parse_opening_tag(text: str, start: int) -> tuple[int, str]:
    j = start
    quote: str | None = None
    while j < len(text):
        c = text[j]
        if quote:
            if c == quote and text[j - 1] != "\\":
                quote = None
            j += 1
            continue
        if c in ('"', "'", "`"):
            quote = c
            j += 1
            continue
        if c == ">":
            return j + 1, text[start : j + 1]
        if c == "/" and j + 1 < len(text) and text[j + 1] == ">":
            return j + 2, text[start : j + 2]
        j += 1
    return j, text[start:j]


def migrate_drawer_width_in_text(text: str) -> tuple[str, int]:
    count = 0
    out: list[str] = []
    i = 0
    tag_res = [re.compile(rf"<{tag}\b") for tag in TAGS]
    while i < len(text):
        earliest = None
        for tag_re in tag_res:
            m = tag_re.search(text, i)
            if m and (earliest is None or m.start() < earliest.start()):
                earliest = m
        if earliest is None:
            out.append(text[i:])
            break
        start = earliest.start()
        out.append(text[i:start])
        end, tag = parse_opening_tag(text, start)
        new_tag, n = re.subn(r"\bwidth\s*=", "size=", tag)
        count += n
        out.append(new_tag)
        i = end
    return "".join(out), count


def main() -> None:
    changed_files = 0
    total = 0
    for path in ROOT.rglob("*"):
        if path.suffix not in EXTS or any(s in path.parts for s in SKIP_PARTS):
            continue
        original = path.read_text(encoding="utf-8")
        updated, n = migrate_drawer_width_in_text(original)
        if not n:
            continue
        changed_files += 1
        total += n
        with path.open("w", encoding="utf-8", newline="\n") as f:
            f.write(updated)
        print(f"{path.relative_to(ROOT.parent)}: {n}")
    print(f"APPLIED: {changed_files} files, {total} replacements")


if __name__ == "__main__":
    main()
