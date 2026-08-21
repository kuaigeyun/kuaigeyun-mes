"""Fill zh-Hant / ja-JP / vi-VN for keys newly added from _i18n_fill.json only."""
from __future__ import annotations

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator
from opencc import OpenCC

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
OPENCC = OpenCC("s2twp")


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def existing_keys(path: Path) -> set[str]:
    keys: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ENTRY_RE.match(line)
        if m:
            keys.add(m.group(2))
    return keys


def apply_phrase_glossary(text: str, glossary: dict[str, str]) -> str:
    if not text or not glossary:
        return text or ""
    for src, dst in sorted(glossary.items(), key=lambda x: len(x[0]), reverse=True):
        text = text.replace(src, dst)
    return text


def to_traditional(text: str, tw_phrases: dict[str, str], tw_post: dict[str, str]) -> str:
    pre = apply_phrase_glossary(text, tw_phrases)
    converted = OPENCC.convert(pre)
    return apply_phrase_glossary(converted, tw_post)


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
        self.cache_path = CACHE_DIR / cache_name
        self.cache = load_json(self.cache_path)
        self.workers = workers
        self._dirty = 0

    def save(self) -> None:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self.cache, ensure_ascii=False, indent=2), encoding="utf-8")

    def translate_one(self, text: str) -> str:
        if not text or not text.strip():
            return text
        if text in self.cache:
            return self.cache[text]
        protected, placeholders = protect_placeholders(text)
        result = None
        for attempt in range(5):
            try:
                time.sleep(0.12 * (attempt + 1))
                result = GoogleTranslator(source="en", target=self.target).translate(protected)
                if result:
                    break
            except Exception as exc:
                if attempt == 4:
                    print(f"[warn] {self.target}: {text[:50]!r} -> {exc}", file=sys.stderr)
                result = None
        if not result:
            result = text
        result = restore_placeholders(result, placeholders)
        result = apply_phrase_glossary(result, self.post_glossary)
        self.cache[text] = result
        self._dirty += 1
        if self._dirty >= 40:
            self.save()
            self._dirty = 0
        return result

    def translate_many(self, values: list[str]) -> dict[str, str]:
        pending = [v for v in values if v not in self.cache]
        print(f"  {self.target}: translate {len(pending)} / {len(values)} unique")

        def task(val: str) -> tuple[str, str]:
            return val, self.translate_one(val)

        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = [pool.submit(task, val) for val in pending]
            done = 0
            for fut in as_completed(futures):
                val, translated = fut.result()
                self.cache[val] = translated
                done += 1
                if done % 100 == 0:
                    print(f"    ... {done}/{len(pending)}")
                    self.save()
        self.save()
        return {v: self.cache.get(v, v) for v in values}


def inject(path: Path, entries: dict[str, str], marker: str) -> int:
    have = existing_keys(path)
    lines = [f"  '{key}': '{ts_escape(entries[key])}'," for key in sorted(entries) if key not in have]
    if not lines:
        print(f"{path.name}: nothing to add")
        return 0
    text = path.read_text(encoding="utf-8")
    block = f"\n  // --- {marker} ---\n" + "\n".join(lines) + "\n"
    match = SPREAD_BLOCK.search(text)
    if not match:
        raise SystemExit(f"{path.name}: cannot find generated spread footer")
    path.write_text(text[: match.start()] + block + text[match.start() :], encoding="utf-8")
    print(f"{path.name}: added {len(lines)}")
    return len(lines)


def main() -> None:
    fill = json.loads(FILL.read_text(encoding="utf-8"))["entries"]
    # Only keys still missing in each target
    tw_phrases = load_json(GLOSSARY_DIR / "zh_tw_phrases.json")
    tw_post = load_json(GLOSSARY_DIR / "zh_tw_post_glossary.json")

    # zh-Hant from zh
    hant_entries = {
        key: to_traditional(row["zh"], tw_phrases, tw_post) for key, row in fill.items()
    }
    inject(LOCALES / "zh-Hant.ts", hant_entries, "i18n gap fill (auto)")

    # ja / vi from en
    for lang, target, gloss, cache in (
        ("ja-JP", "ja", "ja_post_glossary.json", "translate_ja.json"),
        ("vi-VN", "vi", "vi_post_glossary.json", "translate_vi.json"),
    ):
        path = LOCALES / f"{lang}.ts"
        have = existing_keys(path)
        need = {k: v["en"] for k, v in fill.items() if k not in have}
        unique = list(dict.fromkeys(need.values()))
        tr = Translator(target, load_json(GLOSSARY_DIR / gloss), cache, workers=6)
        value_map = tr.translate_many(unique)
        mapped = {k: value_map.get(v, v) for k, v in need.items()}
        inject(path, mapped, "i18n gap fill (auto)")


if __name__ == "__main__":
    main()
