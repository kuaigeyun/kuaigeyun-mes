#!/usr/bin/env python3
"""
Generate zh-Hant / ja-JP / vi-VN locale bundles.

- zh-Hant: OpenCC s2twp + Taiwan phrase glossary from zh-CN
- ja-JP / vi-VN: Google Translate (deep-translator) from en-US + post glossary
- Dedupes by value; caches translations under scripts/.cache/
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator
from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "riveredge-frontend"
LOCALES = FRONTEND / "src" / "locales"
GLOSSARY_DIR = Path(__file__).resolve().parent / "locale_glossary"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"

OPENCC = OpenCC("s2twp")

LANG_CONFIG = {
    "zh-Hant": {
        "source_main": "zh-CN.ts",
        "source_login": "zh-CN.login.ts",
        "source_generated": "zh-CN",
        "import_prefix": "ZhHant",
        "header": "繁體中文語言包",
        "header_en": "Traditional Chinese (Taiwan) language pack",
    },
    "ja-JP": {
        "source_main": "en-US.ts",
        "source_login": "en-US.login.ts",
        "source_generated": "en-US",
        "import_prefix": "Ja",
        "header": "日本語言語パック",
        "header_en": "Japanese language pack",
        "translate_target": "ja",
        "post_glossary": "ja_post_glossary.json",
    },
    "vi-VN": {
        "source_main": "en-US.ts",
        "source_login": "en-US.login.ts",
        "source_generated": "en-US",
        "import_prefix": "Vi",
        "header": "Gói ngôn ngữ tiếng Việt",
        "header_en": "Vietnamese language pack",
        "translate_target": "vi",
        "post_glossary": "vi_post_glossary.json",
    },
}

GENERATED_MODULES = [
    "systemDictionary",
    "presetEntity",
    "codeRulePage",
    "customFieldPage",
]

LINE_PATTERN = re.compile(
    r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*(?://.*)?$"
)
IMPORT_PATTERN = re.compile(
    r"^import (\w+) from '\./generated/(\w+)/(zh-CN|en-US)';$"
)
SPREAD_PATTERN = re.compile(r"^(\s*)\.\.\.(\w+),?\s*$")
PLACEHOLDER_PATTERN = re.compile(r"\{\{[^}]+\}\}")


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def unescape_ts(s: str) -> str:
    return s.replace("\\'", "'").replace("\\n", "\n").replace("\\\\", "\\")


def load_json(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_cache(name: str) -> dict[str, str]:
    path = CACHE_DIR / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_cache(name: str, data: dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_phrase_glossary(text: str | None, glossary: dict[str, str]) -> str:
    if not text:
        return text or ""
    if not glossary:
        return text
    for src, dst in sorted(glossary.items(), key=lambda x: len(x[0]), reverse=True):
        text = text.replace(src, dst)
    return text


def to_traditional(text: str, tw_phrases: dict[str, str]) -> str:
    converted = OPENCC.convert(text)
    return apply_phrase_glossary(converted, tw_phrases)


def protect_placeholders(text: str) -> tuple[str, list[str]]:
    placeholders: list[str] = []

    def repl(match: re.Match[str]) -> str:
        placeholders.append(match.group(0))
        return f"__PH_{len(placeholders) - 1}__"

    return PLACEHOLDER_PATTERN.sub(repl, text), placeholders


def restore_placeholders(text: str, placeholders: list[str]) -> str:
    for i, ph in enumerate(placeholders):
        text = text.replace(f"__PH_{i}__", ph)
    return text


class Translator:
    def __init__(self, target: str, post_glossary: dict[str, str], cache_name: str, workers: int = 6):
        self.target = target
        self.post_glossary = post_glossary
        self.cache = load_cache(cache_name)
        self.cache_name = cache_name
        self.workers = workers
        self._dirty = 0

    def translate_one(self, text: str) -> str:
        if not text or not text.strip():
            return text
        if text in self.cache:
            return self.cache[text]

        protected, placeholders = protect_placeholders(text)
        result: str | None = None
        for attempt in range(5):
            try:
                time.sleep(0.15 * (attempt + 1))
                result = GoogleTranslator(source="en", target=self.target).translate(protected)
                if result:
                    break
            except Exception as exc:
                if attempt == 4:
                    print(f"[warn] translate failed ({self.target}): {text[:60]!r} -> {exc}", file=sys.stderr)
                result = None

        if not result:
            result = text
        result = restore_placeholders(result, placeholders)
        result = apply_phrase_glossary(result, self.post_glossary)
        self.cache[text] = result
        self._dirty += 1
        if self._dirty >= 50:
            save_cache(self.cache_name, self.cache)
            self._dirty = 0
        return result

    def translate_many(self, values: list[str]) -> dict[str, str]:
        pending = [v for v in values if v not in self.cache]
        if pending:
            print(f"  translating {len(pending)} unique strings -> {self.target} (cached: {len(values) - len(pending)})")

        def task(val: str) -> tuple[str, str]:
            return val, self.translate_one(val)

        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = [pool.submit(task, val) for val in pending]
            done = 0
            for fut in as_completed(futures):
                val, translated = fut.result()
                self.cache[val] = translated
                done += 1
                if done % 200 == 0:
                    print(f"    ... {done}/{len(pending)}")
                    save_cache(self.cache_name, self.cache)

        save_cache(self.cache_name, self.cache)
        return {v: self.cache.get(v, v) for v in values}

    def flush(self) -> None:
        save_cache(self.cache_name, self.cache)


def parse_locale_entries(path: Path) -> dict[str, str]:
    entries: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LINE_PATTERN.match(line.strip())
        if m:
            entries[m.group(2)] = unescape_ts(m.group(3))
    return entries


def parse_generated_ts(path: Path) -> dict[str, str]:
    entries: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LINE_PATTERN.match(line.strip())
        if m:
            entries[m.group(2)] = unescape_ts(m.group(3))
    return entries


def write_generated_ts(path: Path, module: str, lang: str, entries: dict[str, str]) -> None:
    const_name = f"{module}{lang.replace('-', '')}"

    lines = [
        f"/** Auto-generated by scripts/generate_extended_locales.py — do not edit manually */",
        f"const {const_name} = {{",
    ]
    for key in sorted(entries.keys()):
        lines.append(f"  '{ts_escape(key)}': '{ts_escape(entries[key])}',")
    lines.append("} as const;")
    lines.append("")
    lines.append(f"export default {const_name};")
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def build_value_map(lang: str, source_entries: dict[str, str], translator: Translator | None, tw_phrases: dict[str, str]) -> dict[str, str]:
    unique_values = list(dict.fromkeys(source_entries.values()))
    if lang == "zh-Hant":
        value_map = {v: to_traditional(v, tw_phrases) for v in unique_values}
    else:
        assert translator is not None
        value_map = translator.translate_many(unique_values)
    return value_map


def transform_main_locale(lang: str, cfg: dict, value_by_source: dict[str, str]) -> None:
    src_path = LOCALES / cfg["source_main"]
    dst_path = LOCALES / f"{lang}.ts"
    prefix = cfg["import_prefix"]
    lines_out: list[str] = [
        "/**",
        f" * {cfg['header']}",
        f" * {cfg['header_en']}",
        " */",
        "",
    ]
    started = False

    for line in src_path.read_text(encoding="utf-8").splitlines():
        if not started:
            if line.strip().startswith("import "):
                started = True
            else:
                continue

        im = IMPORT_PATTERN.match(line.strip())
        if im:
            var_old, module, _src_lang = im.groups()
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
            src_val = unescape_ts(raw_val)
            new_val = value_by_source.get(src_val, src_val)
            lines_out.append(f"{indent}'{ts_escape(key)}': '{ts_escape(new_val)}',")
            continue

        if line.strip() in ("export default {", "};"):
            lines_out.append(line)

    dst_path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
    print(f"  wrote {dst_path.relative_to(ROOT)}")


def transform_login_locale(lang: str, cfg: dict, value_by_source: dict[str, str]) -> None:
    src_path = LOCALES / cfg["source_login"]
    dst_path = LOCALES / f"{lang}.login.ts"
    lines_out: list[str] = []

    for line in src_path.read_text(encoding="utf-8").splitlines():
        m = LINE_PATTERN.match(line)
        if m:
            indent, key, raw_val = m.groups()
            src_val = unescape_ts(raw_val)
            new_val = value_by_source.get(src_val, src_val)
            lines_out.append(f"{indent}'{ts_escape(key)}': '{ts_escape(new_val)}',")
        else:
            lines_out.append(line)

    dst_path.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
    print(f"  wrote {dst_path.relative_to(ROOT)}")


def generate_generated_modules(lang: str, cfg: dict, tw_phrases: dict[str, str], translators: dict[str, Translator]) -> None:
    src_gen = cfg["source_generated"]
    for module in GENERATED_MODULES:
        src_path = LOCALES / "generated" / module / f"{src_gen}.ts"
        if not src_path.exists():
            print(f"  skip missing {src_path}")
            continue
        entries = parse_generated_ts(src_path)
        if lang == "zh-Hant":
            mapped = {k: to_traditional(v, tw_phrases) for k, v in entries.items()}
        else:
            tr = translators[lang]
            unique = list(dict.fromkeys(entries.values()))
            value_map = tr.translate_many(unique)
            mapped = {k: value_map.get(v, v) for k, v in entries.items()}
        dst_path = LOCALES / "generated" / module / f"{lang}.ts"
        write_generated_ts(dst_path, module, lang, mapped)
        print(f"  wrote {dst_path.relative_to(ROOT)} ({len(mapped)} keys)")


def generate_lang(lang: str, workers: int) -> None:
    cfg = LANG_CONFIG[lang]
    print(f"\n=== {lang} ===")
    tw_phrases = load_json(GLOSSARY_DIR / "zh_tw_phrases.json")

    translators: dict[str, Translator] = {}
    if lang != "zh-Hant":
        post_file = GLOSSARY_DIR / cfg["post_glossary"]
        translators[lang] = Translator(
            target=cfg["translate_target"],
            post_glossary=load_json(post_file),
            cache_name=f"translate_{cfg['translate_target']}.json",
            workers=workers,
        )

    main_entries = parse_locale_entries(LOCALES / cfg["source_main"])
    login_entries = parse_locale_entries(LOCALES / cfg["source_login"])

    tr = translators.get(lang)
    main_value_map = build_value_map(lang, main_entries, tr, tw_phrases)
    login_value_map = build_value_map(lang, login_entries, tr, tw_phrases)

    transform_main_locale(lang, cfg, main_value_map)
    transform_login_locale(lang, cfg, login_value_map)
    generate_generated_modules(lang, cfg, tw_phrases, translators)

    if tr:
        tr.flush()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--langs", default="zh-Hant,ja-JP,vi-VN", help="Comma-separated locale codes")
    parser.add_argument("--workers", type=int, default=4, help="Parallel translation workers")
    args = parser.parse_args()

    langs = [x.strip() for x in args.langs.split(",") if x.strip()]
    for lang in langs:
        if lang not in LANG_CONFIG:
            raise SystemExit(f"Unsupported lang: {lang}")
        generate_lang(lang, args.workers)

    print("\nDone.")


if __name__ == "__main__":
    main()
