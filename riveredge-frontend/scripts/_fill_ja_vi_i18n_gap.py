"""Fill ja-JP / vi-VN for gap keys: reuse existing en→lang pairs, then translate."""
from __future__ import annotations

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent
LOCALES = REPO / "riveredge-frontend" / "src" / "locales"
GLOSSARY_DIR = SCRIPTS / "locale_glossary"
CACHE_DIR = SCRIPTS / ".cache"
FILL = REPO / "_i18n_fill.json"

ENTRY_RE = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)',?\s*(?://.*)?$")
SPREAD_BLOCK = re.compile(
    r"\n  \.\.\.systemDictionary\w+,\n  \.\.\.presetEntity\w+,\n  \.\.\.codeRulePage\w+,\n  \.\.\.customFieldPage\w+,\n\};?\s*$",
    re.M,
)
PLACEHOLDER_PATTERN = re.compile(r"\{\{[^}]+\}\}")


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def parse_entries(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ENTRY_RE.match(line)
        if m:
            out[m.group(2)] = m.group(3).replace("\\'", "'").replace("\\n", "\n")
    return out


def apply_phrase_glossary(text: str, glossary: dict[str, str]) -> str:
    if not text or not glossary:
        return text or ""
    for src, dst in sorted(glossary.items(), key=lambda x: len(x[0]), reverse=True):
        text = text.replace(src, dst)
    return text


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


def build_en_value_map(en: dict[str, str], other: dict[str, str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for key, en_val in en.items():
        if key in other and en_val:
            mapping.setdefault(en_val, other[key])
    return mapping


def translate_batch(
    values: list[str],
    target: str,
    post_glossary: dict[str, str],
    cache_name: str,
    workers: int = 4,
) -> dict[str, str]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / cache_name
    cache = load_json(cache_path)
    pending = [v for v in values if v not in cache]
    print(f"[{target}] translate {len(pending)} / {len(values)}", flush=True)

    def one(text: str) -> tuple[str, str]:
        if text in cache:
            return text, cache[text]
        protected, placeholders = protect_placeholders(text)
        result = None
        for attempt in range(6):
            try:
                time.sleep(0.2 * (attempt + 1))
                result = GoogleTranslator(source="en", target=target).translate(protected)
                if result:
                    break
            except Exception as exc:
                if attempt == 5:
                    print(f"[warn] {target}: {text[:40]!r} -> {exc}", file=sys.stderr, flush=True)
                result = None
        if not result:
            result = text
        result = restore_placeholders(result, placeholders)
        result = apply_phrase_glossary(result, post_glossary)
        return text, result

    dirty = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(one, val) for val in pending]
        done = 0
        for fut in as_completed(futures):
            src, dst = fut.result()
            cache[src] = dst
            done += 1
            dirty += 1
            if done % 50 == 0:
                print(f"  [{target}] {done}/{len(pending)}", flush=True)
                cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
                dirty = 0
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return {v: cache.get(v, v) for v in values}


def inject(path: Path, entries: dict[str, str], marker: str) -> int:
    have = parse_entries(path)
    lines = [f"  '{key}': '{ts_escape(entries[key])}'," for key in sorted(entries) if key not in have]
    if not lines:
        print(f"{path.name}: nothing to add", flush=True)
        return 0
    text = path.read_text(encoding="utf-8")
    block = f"\n  // --- {marker} ---\n" + "\n".join(lines) + "\n"
    match = SPREAD_BLOCK.search(text)
    if not match:
        raise SystemExit(f"{path.name}: cannot find generated spread footer")
    path.write_text(text[: match.start()] + block + text[match.start() :], encoding="utf-8")
    print(f"{path.name}: added {len(lines)}", flush=True)
    return len(lines)


def fill_lang(lang: str, target: str, gloss_file: str, cache_name: str) -> None:
    fill = json.loads(FILL.read_text(encoding="utf-8"))["entries"]
    en = parse_entries(LOCALES / "en-US.ts")
    other = parse_entries(LOCALES / f"{lang}.ts")
    reuse = build_en_value_map(en, other)
    # also seed reuse from translate cache later
    need = {k: v["en"] for k, v in fill.items() if k not in other}
    print(f"\n=== {lang}: need {len(need)} keys ===", flush=True)

    mapped: dict[str, str] = {}
    to_translate: list[str] = []
    for key, en_val in need.items():
        if en_val in reuse:
            mapped[key] = reuse[en_val]
        else:
            to_translate.append(en_val)

    unique = list(dict.fromkeys(to_translate))
    print(f"reuse {len(need) - len(to_translate)} keys; unique to translate {len(unique)}", flush=True)

    post = load_json(GLOSSARY_DIR / gloss_file)
    value_map = translate_batch(unique, target, post, cache_name, workers=4) if unique else {}
    for key, en_val in need.items():
        if key not in mapped:
            mapped[key] = value_map.get(en_val, en_val)

    inject(LOCALES / f"{lang}.ts", mapped, "i18n gap fill (auto)")


def main() -> None:
    fill_lang("ja-JP", "ja", "ja_post_glossary.json", "translate_ja.json")
    fill_lang("vi-VN", "vi", "vi_post_glossary.json", "translate_vi.json")
    print("\nDone.", flush=True)


if __name__ == "__main__":
    main()
