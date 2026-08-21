#!/usr/bin/env python3
"""Apply zh-CN UI term consistency: exact values first, then listed phrases in values."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GLOSSARY = Path(__file__).resolve().parent / "locale_glossary" / "zh_cn_ui_consistency.json"
LINE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'(,?)\s*$")


def unescape(raw: str) -> str:
    return raw.replace("\\'", "'").replace("\\\\", "\\")


def escape(val: str) -> str:
    return val.replace("\\", "\\\\").replace("'", "\\'")


def process(path: Path, exact: dict[str, str], by_key: dict[str, str], phrases: dict[str, str]) -> int:
    changed = 0
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LINE.match(line)
        if not m:
            patched = line
            for src, dst in sorted(phrases.items(), key=lambda x: len(x[0]), reverse=True):
                patched = patched.replace(src, dst)
            if patched != line:
                changed += 1
            out.append(patched)
            continue
        indent, key, raw, comma = m.groups()
        val = unescape(raw)
        new_val = by_key.get(key, exact.get(val, val))
        for src, dst in sorted(phrases.items(), key=lambda x: len(x[0]), reverse=True):
            new_val = new_val.replace(src, dst)
        if new_val != val:
            changed += 1
        out.append(f"{indent}'{key}': '{escape(new_val)}'{comma}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return changed


def main() -> None:
    data = json.loads(GLOSSARY.read_text(encoding="utf-8"))
    exact = data["exactValue"]
    by_key = data["exactValueByKey"]
    phrases = data.get("phrasesInValue") or {}
    for rel in ("src/locales/zh-CN.ts", "src/locales/zh-CN.login.ts"):
        path = ROOT / rel
        n = process(path, exact, by_key, phrases)
        print(f"{rel}: {n} lines")


if __name__ == "__main__":
    main()
