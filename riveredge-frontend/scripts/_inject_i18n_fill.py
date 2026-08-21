"""Inject _i18n_fill.json entries into zh-CN.ts and en-US.ts before generated spreads."""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOCALES = REPO / "riveredge-frontend" / "src" / "locales"
FILL = REPO / "_i18n_fill.json"

ENTRY_RE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*(?://.*)?$")
SPREAD_BLOCK = re.compile(
    r"\n  \.\.\.systemDictionary\w+,\n  \.\.\.presetEntity\w+,\n  \.\.\.codeRulePage\w+,\n  \.\.\.customFieldPage\w+,\n\};?\s*$",
    re.M,
)


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def existing_keys(path: Path) -> set[str]:
    keys: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ENTRY_RE.match(line)
        if m:
            keys.add(m.group(2))
    return keys


def inject(lang: str, field: str) -> int:
    path = LOCALES / f"{lang}.ts"
    text = path.read_text(encoding="utf-8")
    have = existing_keys(path)
    fill = json.loads(FILL.read_text(encoding="utf-8"))["entries"]
    lines: list[str] = []
    for key in sorted(fill):
        if key in have:
            continue
        value = fill[key][field]
        lines.append(f"  '{key}': '{ts_escape(value)}',")
    if not lines:
        print(f"{lang}: nothing to add")
        return 0

    block = "\n  // --- i18n gap fill (auto) ---\n" + "\n".join(lines) + "\n"
    match = SPREAD_BLOCK.search(text)
    if not match:
        raise SystemExit(f"{lang}: cannot find generated spread footer")
    new_text = text[: match.start()] + block + text[match.start() :]
    path.write_text(new_text, encoding="utf-8")
    print(f"{lang}: added {len(lines)} keys")
    return len(lines)


def main() -> None:
    n_zh = inject("zh-CN", "zh")
    n_en = inject("en-US", "en")
    print("done", {"zh-CN": n_zh, "en-US": n_en})


if __name__ == "__main__":
    main()
