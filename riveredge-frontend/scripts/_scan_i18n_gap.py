"""One-shot inventory of missing i18n keys. Delete after use."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "riveredge-frontend" / "src"
LOCALES = SRC / "locales"
MANIFESTS = REPO / "riveredge-backend" / "src" / "apps"
ENTRY_RE = re.compile(r"^\s*'([^']+)'\s*:", re.M)
KEY_RE = re.compile(r"^[a-z][a-z0-9_-]*(\.[a-zA-Z0-9_-]+)+$")
T_STATIC = re.compile(r"""(?:\bt\(|i18n\.t\()\s*(['"])([a-zA-Z][^'"]+)\1""")
T_DEFAULT = re.compile(
    r"""(?:\bt\(|i18n\.t\()\s*(['"])([a-zA-Z][^'"]+)\1\s*,\s*\{[^}]*defaultValue"""
)
NS_ASSIGN = re.compile(r"""(?:const|let)\s+NS\s*=\s*['"]([^'"]+)['"]""")
T_NS = re.compile(r"""t\(\s*`\$\{NS\}\.([^`]+)`""")
SKIP_PARTS = {"locales", "node_modules", "__tests__", "generated"}


def load_locale(lang: str) -> set[str]:
    text = (LOCALES / f"{lang}.ts").read_text(encoding="utf-8")
    keys = set(ENTRY_RE.findall(text))
    generated = LOCALES / "generated"
    if generated.exists():
        for path in generated.rglob(f"{lang}.ts"):
            keys.update(ENTRY_RE.findall(path.read_text(encoding="utf-8")))
    return keys


def walk_menu(node: object, acc: list[str]) -> None:
    if isinstance(node, dict):
        title = node.get("title")
        if isinstance(title, str) and KEY_RE.match(title) and title.startswith("app."):
            acc.append(title)
        for value in node.values():
            walk_menu(value, acc)
    elif isinstance(node, list):
        for item in node:
            walk_menu(item, acc)


def is_real(key: str) -> bool:
    if not key or key.startswith("http") or "{{" in key:
        return False
    return "." in key


def bucket(key: str) -> str:
    mapping = (
        ("app.kuaioa", "kuaioa 轻办公"),
        ("app.kuaicaiwu", "kuaicaiwu 轻财务"),
        ("app.kuaiplm", "kuaiplm 快研发"),
        ("app.kuaizhizao", "kuaizhizao 快制造"),
        ("app.master-data", "master-data 主数据"),
        ("app.master_data", "master-data 主数据"),
        ("app.haoligo", "haoligo"),
        ("app.kuaireport", "kuaireport"),
        ("components.", "components 公共组件"),
        ("app.core", "core/system"),
        ("sys.", "core/system"),
    )
    for prefix, name in mapping:
        if key.startswith(prefix):
            return name
    return "other"


def main() -> None:
    zh = load_locale("zh-CN")
    menu_keys: list[str] = []
    for path in MANIFESTS.glob("*/manifest.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        walk_menu(data.get("menu_config", {}), menu_keys)
    menu_missing = sorted(set(key for key in menu_keys if key not in zh))

    used: set[str] = set()
    used_with_default: set[str] = set()
    files_by_key: dict[str, set[str]] = defaultdict(set)

    for path in SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx"} or any(part in path.parts for part in SKIP_PARTS):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        rel = path.relative_to(SRC).as_posix()
        for match in T_STATIC.finditer(text):
            key = match.group(2)
            if key.startswith("import") or "/" in key:
                continue
            used.add(key)
            files_by_key[key].add(rel)
        for match in T_DEFAULT.finditer(text):
            used_with_default.add(match.group(2))
        ns_match = NS_ASSIGN.search(text)
        if ns_match:
            prefix = ns_match.group(1)
            for match in T_NS.finditer(text):
                suffix = match.group(1)
                if "${" in suffix:
                    continue
                key = f"{prefix}.{suffix}"
                used.add(key)
                files_by_key[key].add(rel)

    missing = sorted(key for key in used if is_real(key) and key not in zh)
    missing_no_default = [key for key in missing if key not in used_with_default]
    missing_with_default = [key for key in missing if key in used_with_default]
    by_bucket: dict[str, list[str]] = defaultdict(list)
    for key in missing_no_default:
        by_bucket[bucket(key)].append(key)

    print("=== SUMMARY ===")
    print("zh-CN keys", len(zh))
    print("static+ns used", len(used))
    print("menu missing", len(menu_missing))
    print("code missing (raw key)", len(missing_no_default))
    print("code missing but defaultValue", len(missing_with_default))
    print()
    for name in sorted(by_bucket, key=lambda item: -len(by_bucket[item])):
        rows = by_bucket[name]
        print(f"--- {name} ({len(rows)}) ---")
        for key in rows[:50]:
            sample = next(iter(files_by_key[key]))
            print(f"  {key}  [{sample}]")
        if len(rows) > 50:
            print(f"  ... +{len(rows) - 50} more")

    out = {
        "zh_key_count": len(zh),
        "used_count": len(used),
        "menu_missing": menu_missing,
        "raw_missing_count": len(missing_no_default),
        "default_missing_count": len(missing_with_default),
        "buckets": {name: keys for name, keys in by_bucket.items()},
        "files": {key: sorted(files_by_key[key])[:3] for key in missing_no_default},
        "default_keys": missing_with_default,
    }
    dest = REPO / "_i18n_gap.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote", dest)


if __name__ == "__main__":
    main()
