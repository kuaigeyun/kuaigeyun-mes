#!/usr/bin/env python3
"""Fill missing en-US / ja-JP / vi-VN / lo-LA keys from zh-CN.

Priority:
1. Same zh-CN value already translated in the target locale
2. Exact string in locale_glossary/professional_zh_en_ja_vi.json (and chunk merges)
3. Leave unfilled and report (do not copy Simplified Chinese into other langs)
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "locales"
GLOSSARY_DIR = Path(__file__).resolve().parent / "locale_glossary"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
LANGS = ("en-US", "ja-JP", "vi-VN", "lo-LA")
LANG_INDEX = {"en-US": "en", "ja-JP": "ja", "vi-VN": "vi", "lo-LA": "lo"}

LINE_PATTERN = re.compile(
    r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*(?://.*)?$"
)
IMPORT_PATTERN = re.compile(r"^import (\w+) from '\./generated/(\w+)/(zh-CN|en-US)';$")
SPREAD_PATTERN = re.compile(r"^(\s*)\.\.\.(\w+),?\s*$")
PH = re.compile(r"\{\{[^}]+\}\}")


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def unescape_ts(s: str) -> str:
    return s.replace("\\'", "'").replace("\\n", "\n").replace("\\\\", "\\")


def parse_entries(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LINE_PATTERN.match(line)
        if m:
            out[m.group(2)] = unescape_ts(m.group(3))
    return out


def load_professional() -> dict[str, dict[str, str]]:
    merged: dict[str, dict[str, str]] = {}
    paths = [GLOSSARY_DIR / "professional_zh_en_ja_vi.json"]
    paths.extend(sorted(CACHE_DIR.glob("tr_chunk_*_out.json")))
    for path in paths:
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for zh, row in data.items():
            if isinstance(row, dict):
                merged[zh] = {**merged.get(zh, {}), **row}
    return merged


def value_map_from_existing(cn: dict[str, str], loc: dict[str, str]) -> dict[str, str]:
    zh2t: dict[str, str] = {}
    for key, val in loc.items():
        zh = cn.get(key)
        if zh and zh not in zh2t:
            zh2t[zh] = val
    return zh2t


def resolve(
    zh: str,
    lang: str,
    zh2t: dict[str, str],
    professional: dict[str, dict[str, str]],
) -> str | None:
    if zh in zh2t:
        return zh2t[zh]
    row = professional.get(zh)
    if row:
        hit = row.get(LANG_INDEX[lang])
        if hit:
            if Counter(PH.findall(zh)) != Counter(PH.findall(hit)):
                return None
            return hit
    return None


def transform_main(
    lang: str,
    cn: dict[str, str],
    existing: dict[str, str],
    zh2t: dict[str, str],
    professional: dict[str, dict[str, str]],
) -> tuple[int, int]:
    src_path = LOCALES / "zh-CN.ts"
    dst_path = LOCALES / f"{lang}.ts"
    prefix = {"en-US": "En", "ja-JP": "Ja", "vi-VN": "Vi", "lo-LA": "Lo"}[lang]
    lines_out: list[str] = [
        "/**",
        {
            "en-US": "English language pack",
            "ja-JP": "日本語言語パック",
            "vi-VN": "Gói ngôn ngữ tiếng Việt",
            "lo-LA": "ແພັກເກັດພາສາລາວ",
        }[lang],
        " */",
        "",
    ]
    started = False
    kept = filled = missing = 0
    unresolved: list[str] = []

    for line in src_path.read_text(encoding="utf-8").splitlines():
        if not started:
            if line.strip().startswith("import "):
                started = True
            else:
                continue

        im = IMPORT_PATTERN.match(line.strip())
        if im:
            var_old, module, _src = im.groups()
            var_new = re.sub(r"(Zh|En)$", prefix, var_old) if var_old.endswith(("Zh", "En")) else f"{module}{prefix}"
            lines_out.append(f"import {var_new} from './generated/{module}/{lang}';")
            continue

        sm = SPREAD_PATTERN.match(line)
        if sm:
            indent, var_old = sm.groups()
            var_new = re.sub(r"(Zh|En)$", prefix, var_old)
            lines_out.append(f"{indent}...{var_new},")
            continue

        m = LINE_PATTERN.match(line)
        if m:
            indent, key, raw_val = m.groups()
            zh = unescape_ts(raw_val)
            if key in existing:
                new_val = existing[key]
                kept += 1
            else:
                hit = resolve(zh, lang, zh2t, professional)
                if hit is None:
                    missing += 1
                    unresolved.append(key)
                    continue
                new_val = hit
                filled += 1
            lines_out.append(f"{indent}'{ts_escape(key)}': '{ts_escape(new_val)}',")
            continue

        if line.strip() in ("export default {", "};"):
            lines_out.append(line)

    dst_path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
    if unresolved:
        report = CACHE_DIR / f"unresolved_{lang}.txt"
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        report.write_text("\n".join(unresolved) + "\n", encoding="utf-8")
    print(f"{lang}: keep={kept} fill={filled} still-missing={missing}")
    return filled, missing


def transform_login(
    lang: str,
    cn_login: dict[str, str],
    existing: dict[str, str],
    zh2t: dict[str, str],
    professional: dict[str, dict[str, str]],
) -> None:
    src_path = LOCALES / "zh-CN.login.ts"
    dst_path = LOCALES / f"{lang}.login.ts"
    lines_out: list[str] = []
    for line in src_path.read_text(encoding="utf-8").splitlines():
        m = LINE_PATTERN.match(line)
        if m:
            indent, key, raw_val = m.groups()
            zh = unescape_ts(raw_val)
            if key in existing:
                new_val = existing[key]
            else:
                hit = resolve(zh, lang, zh2t, professional)
                if hit is None:
                    lines_out.append(line)
                    continue
                new_val = hit
            lines_out.append(f"{indent}'{ts_escape(key)}': '{ts_escape(new_val)}',")
        else:
            lines_out.append(line)
    dst_path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")


def main() -> None:
    professional = load_professional()
    print(f"professional strings: {len(professional)}")
    cn = parse_entries(LOCALES / "zh-CN.ts")
    cn_login = parse_entries(LOCALES / "zh-CN.login.ts")
    for lang in LANGS:
        existing = parse_entries(LOCALES / f"{lang}.ts")
        zh2t = value_map_from_existing(cn, existing)
        transform_main(lang, cn, existing, zh2t, professional)
        existing_login = parse_entries(LOCALES / f"{lang}.login.ts")
        zh2t_login = {**zh2t, **value_map_from_existing(cn_login, existing_login)}
        transform_login(lang, cn_login, existing_login, zh2t_login, professional)


if __name__ == "__main__":
    main()
