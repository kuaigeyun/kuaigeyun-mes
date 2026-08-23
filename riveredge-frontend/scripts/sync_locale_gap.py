"""Sync missing locale keys from zh-CN and backfill untranslated lo-LA entries.

P0 usage:
  python scripts/sync_locale_gap.py sync-missing
  python scripts/sync_locale_gap.py backfill-lo --prefix pages.system.configCenter.notification
  python scripts/build_lo_glossary.py
  python scripts/sync_locale_gap.py apply-glossary-lo
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator
from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "locales"
GLOSSARY_DIR = Path(__file__).resolve().parent / "locale_glossary"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"

TARGET_LOCALES = ("zh-Hant", "en-US", "ja-JP", "vi-VN", "lo-LA")
SPREAD_BLOCK = re.compile(
    r"\n  \.\.\.systemDictionary\w+,\n  \.\.\.presetEntity\w+,\n  \.\.\.codeRulePage\w+,\n  \.\.\.customFieldPage\w+,\n\};?\s*$",
    re.M,
)
KEY_LINE = re.compile(r"^\s*'((?:\\'|[^'])+)'\s*:\s*(.*)$")
PLACEHOLDER_PATTERN = re.compile(r"\{\{[^}]+\}\}")
OPENCC = OpenCC("s2twp")


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def extract_entries(text: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = KEY_LINE.match(lines[i])
        if not m:
            i += 1
            continue
        key, rest = m.group(1), m.group(2).strip()
        if rest.startswith("'") and rest.endswith("',"):
            entries[key] = rest[1:-2].replace("\\'", "'").replace("\\n", "\n")
            i += 1
            continue
        if not rest:
            i += 1
            parts: list[str] = []
            while i < len(lines):
                stripped = lines[i].strip()
                if stripped.endswith("',"):
                    parts.append(stripped[:-2].strip().strip("'").replace("\\'", "'"))
                    i += 1
                    break
                parts.append(stripped.strip("'").replace("\\'", "'"))
                i += 1
            entries[key] = "\n".join(parts)
            continue
        i += 1
    return entries


def format_entry(key: str, value: str) -> str:
    escaped = ts_escape(value)
    if "\n" in value or len(escaped) > 100:
        return f"  '{key}':\n    '{escaped}',"
    return f"  '{key}': '{escaped}',"


def inject(path: Path, entries: dict[str, str], marker: str) -> int:
    if not entries:
        print(f"{path.name}: nothing to add")
        return 0
    text = path.read_text(encoding="utf-8")
    have = set(extract_entries(text))
    lines = [format_entry(k, entries[k]) for k in sorted(entries) if k not in have]
    if not lines:
        print(f"{path.name}: nothing to add")
        return 0
    block = f"\n  // --- {marker} ---\n" + "\n".join(lines) + "\n"
    match = SPREAD_BLOCK.search(text)
    if not match:
        raise SystemExit(f"{path.name}: cannot find generated spread footer")
    path.write_text(text[: match.start()] + block + text[match.start() :], encoding="utf-8")
    print(f"{path.name}: added {len(lines)}")
    return len(lines)


def update_entries(path: Path, entries: dict[str, str]) -> int:
    """Replace existing single-line locale entries in place."""
    if not entries:
        print(f"{path.name}: nothing to update")
        return 0
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    key_prefix_re = re.compile(r"^(\s*)'((?:\\'|[^'])+)'\s*:\s*")
    updated = 0
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = key_prefix_re.match(line)
        if not m:
            out.append(line)
            i += 1
            continue
        key = m.group(2)
        if key not in entries:
            out.append(line)
            i += 1
            continue
        indent = m.group(1)
        new_val = entries[key]
        if "\n" in new_val or len(ts_escape(new_val)) > 100:
            out.append(f"{indent}'{key}':\n{indent}  '{ts_escape(new_val)}',\n")
        else:
            out.append(f"{indent}'{key}': '{ts_escape(new_val)}',\n")
        updated += 1
        i += 1
        # skip continuation lines of old multiline value
        while i < len(lines) and not KEY_LINE.match(lines[i]) and not lines[i].strip().startswith("..."):
            if lines[i].strip().endswith("',") or lines[i].strip().endswith("'"):
                i += 1
                break
            i += 1
    if updated:
        path.write_text("".join(out), encoding="utf-8")
    print(f"{path.name}: updated {updated}")
    return updated


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


class Translator:
    def __init__(
        self,
        source: str,
        target: str,
        post_glossary: dict[str, str],
        cache_name: str,
        workers: int = 6,
    ):
        self.source = source
        self.target = target
        self.post_glossary = post_glossary
        self.cache_path = CACHE_DIR / cache_name
        self.cache = load_json(self.cache_path)
        self.workers = workers
        self._dirty = 0
        self._lock = threading.Lock()

    def save(self) -> None:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with self._lock:
            snapshot = dict(self.cache)
        self.cache_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")

    def translate_one(self, text: str) -> str:
        if not text or not text.strip():
            return text
        cache_key = f"{self.source}->{self.target}:{text}"
        with self._lock:
            cached = self.cache.get(cache_key)
        if cached is not None:
            return apply_phrase_glossary(cached, self.post_glossary)
        protected, placeholders = protect_placeholders(text)
        result = None
        for attempt in range(5):
            try:
                time.sleep(0.12 * (attempt + 1))
                result = GoogleTranslator(source=self.source, target=self.target).translate(protected)
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
        should_save = False
        with self._lock:
            self.cache[cache_key] = result
            self._dirty += 1
            if self._dirty >= 40:
                self._dirty = 0
                should_save = True
        if should_save:
            self.save()
        return result

    def translate_many(self, values: list[str]) -> dict[str, str]:
        with self._lock:
            pending = [v for v in values if f"{self.source}->{self.target}:{v}" not in self.cache]
        print(f"  {self.source}->{self.target}: translate {len(pending)} / {len(values)} unique")

        def task(val: str) -> tuple[str, str]:
            return val, self.translate_one(val)

        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = [pool.submit(task, val) for val in pending]
            done = 0
            for fut in as_completed(futures):
                val, translated = fut.result()
                done += 1
                if done % 100 == 0:
                    print(f"    ... {done}/{len(pending)}")
                    self.save()
        self.save()
        return {v: self.translate_one(v) for v in values}


def to_traditional(text: str) -> str:
    tw_phrases = load_json(GLOSSARY_DIR / "zh_tw_phrases.json")
    tw_post = load_json(GLOSSARY_DIR / "zh_tw_post_glossary.json")
    pre = apply_phrase_glossary(text, tw_phrases)
    converted = OPENCC.convert(pre)
    return apply_phrase_glossary(converted, tw_post)


def cmd_sync_missing() -> None:
    zh_path = LOCALES / "zh-CN.ts"
    zh = extract_entries(zh_path.read_text(encoding="utf-8"))

    # English first (source for ja/vi/lo)
    en_path = LOCALES / "en-US.ts"
    en_have = set(extract_entries(en_path.read_text(encoding="utf-8")))
    en_need = {k: zh[k] for k in sorted(zh) if k not in en_have}
    if en_need:
        unique_zh = list(dict.fromkeys(en_need.values()))
        en_tr = Translator("zh-CN", "en", {}, "translate_en_from_zh.json")
        en_map = en_tr.translate_many(unique_zh)
        en_entries = {k: en_map.get(v, v) for k, v in en_need.items()}
        inject(en_path, en_entries, "P0 locale gap sync (auto)")

    en = extract_entries(en_path.read_text(encoding="utf-8"))

    # zh-Hant
    hant_path = LOCALES / "zh-Hant.ts"
    hant_have = set(extract_entries(hant_path.read_text(encoding="utf-8")))
    hant_entries = {k: to_traditional(zh[k]) for k in sorted(zh) if k not in hant_have}
    inject(hant_path, hant_entries, "P0 locale gap sync (auto)")

    # ja / vi / lo from English
    for lang, target, gloss, cache in (
        ("ja-JP", "ja", "ja_post_glossary.json", "translate_ja_p0.json"),
        ("vi-VN", "vi", "vi_post_glossary.json", "translate_vi_p0.json"),
        ("lo-LA", "lo", "lo_post_glossary.json", "translate_lo_p0.json"),
    ):
        path = LOCALES / f"{lang}.ts"
        have = set(extract_entries(path.read_text(encoding="utf-8")))
        need = {k: en[k] for k in sorted(zh) if k not in have and k in en}
        if not need:
            continue
        unique = list(dict.fromkeys(need.values()))
        tr = Translator("en", target, load_json(GLOSSARY_DIR / gloss), cache, workers=6)
        value_map = tr.translate_many(unique)
        mapped = {k: value_map.get(v, v) for k, v in need.items()}
        inject(path, mapped, "P0 locale gap sync (auto)")


def cmd_backfill_lo(prefix: str | None, limit: int | None) -> None:
    zh = extract_entries((LOCALES / "zh-CN.ts").read_text(encoding="utf-8"))
    en = extract_entries((LOCALES / "en-US.ts").read_text(encoding="utf-8"))
    lo_path = LOCALES / "lo-LA.ts"
    lo = extract_entries(lo_path.read_text(encoding="utf-8"))

    candidates: list[str] = []
    for key in sorted(lo):
        if key not in en or key not in zh:
            continue
        if lo[key] != en[key]:
            continue
        if prefix and not key.startswith(prefix):
            continue
        # skip if already has Lao script
        if any("\u0e80" <= c <= "\u0eff" for c in lo[key]):
            continue
        candidates.append(key)

    if limit is not None:
        candidates = candidates[:limit]

    if not candidates:
        print("backfill-lo: no candidates")
        return

    print(f"backfill-lo: {len(candidates)} keys" + (f" prefix={prefix}" if prefix else ""))
    unique_en = list(dict.fromkeys(en[k] for k in candidates))
    tr = Translator("en", "lo", load_json(GLOSSARY_DIR / "lo_post_glossary.json"), "translate_lo_backfill.json", workers=8)
    value_map = tr.translate_many(unique_en)
    updates = {k: value_map.get(en[k], en[k]) for k in candidates}
    update_entries(lo_path, updates)


def cmd_apply_glossary_lo(prefix: str | None, limit: int | None) -> None:
    """Apply lo_post_glossary to lo-LA entries still identical to en-US."""
    glossary = load_json(GLOSSARY_DIR / "lo_post_glossary.json")
    en = extract_entries((LOCALES / "en-US.ts").read_text(encoding="utf-8"))
    lo_path = LOCALES / "lo-LA.ts"
    lo = extract_entries(lo_path.read_text(encoding="utf-8"))

    candidates: list[str] = []
    for key in sorted(lo):
        if key not in en:
            continue
        if lo[key] != en[key]:
            continue
        if prefix and not key.startswith(prefix):
            continue
        if any("\u0e80" <= c <= "\u0eff" for c in lo[key]):
            continue
        glossed = apply_phrase_glossary(en[key], glossary)
        if glossed != en[key]:
            candidates.append(key)

    if limit is not None:
        candidates = candidates[:limit]

    if not candidates:
        print("apply-glossary-lo: no candidates")
        return

    print(f"apply-glossary-lo: {len(candidates)} keys" + (f" prefix={prefix}" if prefix else ""))
    updates = {k: apply_phrase_glossary(en[k], glossary) for k in candidates}
    update_entries(lo_path, updates)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync locale gaps from zh-CN")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("sync-missing", help="Add keys present in zh-CN but missing in other locales")

    p_lo = sub.add_parser("backfill-lo", help="Translate lo-LA entries still identical to en-US")
    p_lo.add_argument("--prefix", default=None, help="Only keys starting with this prefix")
    p_lo.add_argument("--limit", type=int, default=None, help="Max keys to translate in one run")

    p_gloss = sub.add_parser("apply-glossary-lo", help="Apply lo_post_glossary to lo-LA entries still identical to en-US")
    p_gloss.add_argument("--prefix", default=None, help="Only keys starting with this prefix")
    p_gloss.add_argument("--limit", type=int, default=None, help="Max keys to update in one run")

    args = parser.parse_args()
    if args.cmd == "sync-missing":
        cmd_sync_missing()
    elif args.cmd == "backfill-lo":
        cmd_backfill_lo(args.prefix, args.limit)
    elif args.cmd == "apply-glossary-lo":
        cmd_apply_glossary_lo(args.prefix, args.limit)


if __name__ == "__main__":
    main()
