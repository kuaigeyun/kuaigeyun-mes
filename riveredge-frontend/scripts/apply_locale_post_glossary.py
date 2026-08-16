#!/usr/bin/env python3
"""Apply post-translation phrase glossaries to existing locale TS files."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "riveredge-frontend"
GLOSSARY_DIR = Path(__file__).resolve().parent / "locale_glossary"

LINE_PATTERN = re.compile(
    r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*$"
)


def apply_glossary(text: str, glossary: dict[str, str]) -> str:
    for src, dst in sorted(glossary.items(), key=lambda x: len(x[0]), reverse=True):
        text = text.replace(src, dst)
    return text


def process_file(path: Path, glossary: dict[str, str]) -> int:
    changed = 0
    lines_out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LINE_PATTERN.match(line)
        if m:
            indent, key, raw = m.groups()
            val = raw.replace("\\'", "'")
            new_val = apply_glossary(val, glossary)
            if new_val != val:
                changed += 1
            esc = new_val.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
            lines_out.append(f"{indent}'{key}': '{esc}',")
        else:
            lines_out.append(line)
    path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
    return changed


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--langs", default="zh-Hant,ja-JP,vi-VN")
    args = parser.parse_args()
    all_targets = {
        "zh-Hant": load_json(GLOSSARY_DIR / "zh_tw_post_glossary.json"),
        "ja-JP": load_json(GLOSSARY_DIR / "ja_post_glossary.json"),
        "vi-VN": load_json(GLOSSARY_DIR / "vi_post_glossary.json"),
    }
    wanted = {x.strip() for x in args.langs.split(",") if x.strip()}
    targets = {k: v for k, v in all_targets.items() if k in wanted}
    for lang, glossary in targets.items():
        total = 0
        for path in (FRONTEND / "src" / "locales").rglob(f"{lang}*.ts"):
            total += process_file(path, glossary)
        print(f"{lang}: updated {total} lines")


def load_json(path: Path) -> dict[str, str]:
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
