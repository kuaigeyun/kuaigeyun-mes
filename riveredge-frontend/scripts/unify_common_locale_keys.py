#!/usr/bin/env python3
"""Retarget duplicate generic locale keys to common.* and drop unused entries.

Only keys whose zh-CN value equals an existing common.* hub value.
Skips permission.action / uniAction / login / documentStatus / lifecycle / preset.

Quoted `t('domain.key')` and template `t(\`${NS}.leaf\`)` are both rewritten.
Deletion keeps a key only if a quoted or resolved template reference remains.

`--fix-dynamic` retargets leftover templates using HEAD zh-CN (after a quoted-only run).
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
LOCALES = SRC / "locales"
LANGS = ("zh-CN", "zh-Hant", "en-US", "ja-JP", "vi-VN", "lo-LA")
ENTRY = re.compile(r"^(\s*)'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'(,?)\s*(?://.*)?$")
SKIP_PREFIXES = (
    "common.",
    "permission.action.",
    "components.uniAction.",
    "pages.login.",
    "documentStatus.",
    "lifecycle.",
    "preset.",
)
CODE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx"}
SKIP_DIR = {"locales", "node_modules", "__tests__", "generated"}

CANONICAL_COMMON_KEYS = (
    "common.save",
    "common.reset",
    "common.confirm",
    "common.cancel",
    "common.back",
    "common.next",
    "common.previous",
    "common.actions",
    "common.more",
    "common.status",
    "common.enabled",
    "common.disabled",
    "common.yes",
    "common.no",
    "common.remark",
    "common.refresh",
    "common.close",
    "common.create",
    "common.edit",
    "common.detail",
    "common.view",
    "common.delete",
    "common.remove",
    "common.search",
    "common.select",
    "common.import",
    "common.submit",
    "common.quantity",
    "common.unit",
    "common.name",
    "common.code",
    "common.export",
    "common.print",
    "common.query",
    "common.loading",
    "common.loadFailed",
    "common.saveSuccess",
    "common.saveFailed",
    "common.deleteSuccess",
    "common.deleteFailed",
    "common.updateSuccess",
    "common.updateFailed",
    "common.createSuccess",
    "common.createFailed",
    "common.operationFailed",
    "common.createdAt",
    "common.updatedAt",
    "common.batchDelete",
    "common.clear",
    "common.copyFailed",
    "common.copySuccess",
    "common.exportNoData",
    "common.exportFailed",
    "common.permissionDenied",
)


def parse_locale(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ENTRY.match(line)
        if m:
            out[m.group(2)] = m.group(3).replace("\\'", "'")
    return out


def skip_key(key: str) -> bool:
    return any(key.startswith(p) for p in SKIP_PREFIXES)


def quoted_patterns(key: str) -> tuple[str, str]:
    return f"'{key}'", f'"{key}"'


CONST_RE = re.compile(
    r"\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*['\"]([^'\"]+)['\"]"
)
DYN_RE = re.compile(r"t\(\s*`\$\{([A-Za-z_][A-Za-z0-9_]*)\}\.([A-Za-z0-9_.]+)`")
REPO_ROOT = ROOT.parent


def iter_source_files() -> list[Path]:
    out: list[Path] = []
    for path in SRC.rglob("*"):
        if path.suffix not in CODE_SUFFIXES or any(p in path.parts for p in SKIP_DIR):
            continue
        out.append(path)
    return out


def value_to_canonical(zh: dict[str, str]) -> dict[str, str]:
    value_to_common: dict[str, str] = {}
    for ck in CANONICAL_COMMON_KEYS:
        val = zh.get(ck)
        if not val:
            raise SystemExit(f"missing canonical {ck}")
        if val not in value_to_common:
            value_to_common[val] = ck
    return value_to_common


def mapping_from_zh(zh: dict[str, str]) -> dict[str, str]:
    value_to_common = value_to_canonical(zh)
    mapping: dict[str, str] = {}
    for key, val in zh.items():
        if skip_key(key) or val not in value_to_common:
            continue
        mapping[key] = value_to_common[val]
    return mapping


def parse_locale_text(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        m = ENTRY.match(line)
        if m:
            out[m.group(2)] = m.group(3).replace("\\'", "'")
    return out


def git_head_zh_cn() -> dict[str, str]:
    raw = subprocess.check_output(
        ["git", "show", "HEAD:riveredge-frontend/src/locales/zh-CN.ts"],
        cwd=REPO_ROOT,
    )
    return parse_locale_text(raw.decode("utf-8"))


def retarget_dynamic(mapping: dict[str, str]) -> tuple[int, int]:
    """Rewrite t(`${NS}.leaf`) when NS.leaf was a generic duplicate of common.*."""
    replaced_files = 0
    replaced_hits = 0
    for path in iter_source_files():
        text = path.read_text(encoding="utf-8")
        consts = {m.group(1): m.group(2) for m in CONST_RE.finditer(text)}
        matches = []
        for m in DYN_RE.finditer(text):
            var, leaf = m.group(1), m.group(2)
            prefix = consts.get(var)
            if not prefix:
                continue
            old = f"{prefix}.{leaf}"
            new = mapping.get(old)
            if not new:
                continue
            matches.append((m.start(), m.end(), m.group(0), f"t('{new}'"))
        if not matches:
            continue
        # Rightmost first so offsets stay valid.
        matches.sort(key=lambda x: x[0], reverse=True)
        for start, end, old_s, new_s in matches:
            if text[start:end] != old_s:
                continue
            text = text[:start] + new_s + text[end:]
            replaced_hits += 1
        path.write_text(text, encoding="utf-8")
        replaced_files += 1
    return replaced_files, replaced_hits


def dynamic_referenced_keys(mapping: dict[str, str]) -> set[str]:
    remaining: set[str] = set()
    for path in iter_source_files():
        text = path.read_text(encoding="utf-8")
        consts = {m.group(1): m.group(2) for m in CONST_RE.finditer(text)}
        for m in DYN_RE.finditer(text):
            var, leaf = m.group(1), m.group(2)
            prefix = consts.get(var)
            if not prefix:
                continue
            old = f"{prefix}.{leaf}"
            if old in mapping:
                remaining.add(old)
    return remaining


def main() -> None:
    zh = parse_locale(LOCALES / "zh-CN.ts")
    mapping = mapping_from_zh(zh)

    print(f"candidate keys: {len(mapping)}")
    by_target: dict[str, int] = {}
    for src, dst in mapping.items():
        by_target[dst] = by_target.get(dst, 0) + 1
    for dst, n in sorted(by_target.items(), key=lambda x: -x[1])[:20]:
        print(f"  {n:4d} -> {dst}")

    # Longest keys first so shorter prefixes cannot eat longer keys.
    ordered = sorted(mapping.items(), key=lambda x: len(x[0]), reverse=True)

    code_hits: dict[str, int] = {k: 0 for k in mapping}
    replaced_files = 0
    for path in iter_source_files():
        text = path.read_text(encoding="utf-8")
        orig = text
        for old, new in ordered:
            for qold, qnew in zip(quoted_patterns(old), quoted_patterns(new)):
                count = text.count(qold)
                if count:
                    code_hits[old] += count
                    text = text.replace(qold, qnew)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            replaced_files += 1
    dyn_files, dyn_hits = retarget_dynamic(mapping)
    print(f"updated source files: {replaced_files}")
    print(f"dynamic retarget files={dyn_files} hits={dyn_hits}")
    used = sum(1 for n in code_hits.values() if n)
    print(f"keys referenced in source before deletion check: {used}")

    # Remaining references (after rewrite) — keep quoted *and* `${NS}.leaf` templates.
    remaining: set[str] = set()
    blob_parts: list[str] = []
    for path in iter_source_files():
        blob_parts.append(path.read_text(encoding="utf-8"))
    blob = "\n".join(blob_parts)
    for old in mapping:
        a, b = quoted_patterns(old)
        if a in blob or b in blob:
            remaining.add(old)
    remaining |= dynamic_referenced_keys(mapping)
    drop = [k for k in mapping if k not in remaining]
    print(f"drop unused locale keys: {len(drop)}")
    print(f"keep still-referenced: {len(remaining)}")

    drop_set = set(drop)
    for lang in LANGS:
        path = LOCALES / f"{lang}.ts"
        kept: list[str] = []
        removed = 0
        for line in path.read_text(encoding="utf-8").splitlines():
            m = ENTRY.match(line)
            if m and m.group(2) in drop_set:
                removed += 1
                continue
            kept.append(line)
        path.write_text("\n".join(kept) + "\n", encoding="utf-8")
        print(f"  {lang}.ts removed {removed}")


def fix_dynamic_from_head() -> None:
    """Retarget leftover `${NS}.leaf` calls using HEAD zh-CN values (after a quoted-only pass)."""
    current = parse_locale(LOCALES / "zh-CN.ts")
    head = git_head_zh_cn()
    value_to_common = value_to_canonical(current)
    remapped: dict[str, str] = {}
    for old, val in head.items():
        if skip_key(old) or val not in value_to_common:
            continue
        remapped[old] = value_to_common[val]
    files, hits = retarget_dynamic(remapped)
    print(f"dynamic mapping size={len(remapped)} files={files} hits={hits}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--fix-dynamic":
        fix_dynamic_from_head()
    else:
        main()
