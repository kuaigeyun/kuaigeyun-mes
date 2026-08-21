#!/usr/bin/env python3
"""
扫描应用 manifest 菜单 title（i18n key）是否已写入前端 locale。

侧栏标题唯一真源是 manifest `menu_config` 的 `title`；缺译时会露出
`app.xxx.menu...` 或回退成路径末段（Settings / Vat-ledger）。

用法:
  python scripts/scan_manifest_menu_i18n.py
  python scripts/scan_manifest_menu_i18n.py --json
  python scripts/scan_manifest_menu_i18n.py --fail-on high
  python scripts/scan_manifest_menu_i18n.py --fail-on medium

分级:
  high   — zh-CN 缺键（中文环境侧栏必坏）
  medium — 其它语种相对 zh-CN / manifest 缺键
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MANIFESTS = REPO / "riveredge-backend" / "src" / "apps"
LOCALES = REPO / "riveredge-frontend" / "src" / "locales"

REQUIRED_LOCALES = ("zh-CN", "zh-Hant", "en-US", "ja-JP", "vi-VN", "lo-LA")
KEY_RE = re.compile(r"^[a-z][a-z0-9_-]*(\.[a-zA-Z0-9_-]+)+$")
ENTRY_RE = re.compile(r"^\s*'([^']+)'\s*:", re.M)


def collect_menu_titles(node: object, out: list[tuple[str, str]]) -> None:
    if isinstance(node, dict):
        title = node.get("title")
        if isinstance(title, str) and KEY_RE.match(title) and title.startswith("app."):
            path = node.get("path") if isinstance(node.get("path"), str) else ""
            out.append((title, path))
        for value in node.values():
            collect_menu_titles(value, out)
    elif isinstance(node, list):
        for item in node:
            collect_menu_titles(item, out)


def load_locale_keys(lang: str) -> set[str]:
    path = LOCALES / f"{lang}.ts"
    if not path.exists():
        return set()
    text = path.read_text(encoding="utf-8")
    keys = set(ENTRY_RE.findall(text))
    generated = LOCALES / "generated"
    if generated.exists():
        for gen in generated.rglob(f"{lang}.ts"):
            keys.update(ENTRY_RE.findall(gen.read_text(encoding="utf-8")))
    return keys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument(
        "--fail-on",
        choices=("high", "medium", "never"),
        default="never",
        help="Exit 1 when findings at this severity or higher exist",
    )
    args = parser.parse_args()

    menu_keys: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for manifest_path in sorted(MANIFESTS.glob("*/manifest.json")):
        app = manifest_path.parent.name
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        found: list[tuple[str, str]] = []
        collect_menu_titles(data.get("menu_config"), found)
        # app root name is also shown in sidebar / tabs
        root_title = None
        if isinstance(data.get("menu_config"), dict):
            root_title = data["menu_config"].get("title")
        if isinstance(root_title, str) and KEY_RE.match(root_title):
            found.append((root_title, data["menu_config"].get("path") or f"/apps/{app}"))
        for key, path in found:
            menu_keys[app][key].add(path or "(group)")

    locale_keys = {lang: load_locale_keys(lang) for lang in REQUIRED_LOCALES}
    zh_keys = locale_keys["zh-CN"]

    high: list[dict] = []
    medium: list[dict] = []

    for app, key_map in sorted(menu_keys.items()):
        for key, paths in sorted(key_map.items()):
            path_list = sorted(paths)
            if key not in zh_keys:
                high.append(
                    {
                        "severity": "high",
                        "app": app,
                        "key": key,
                        "paths": path_list,
                        "missing_in": ["zh-CN"],
                    }
                )
                continue
            missing_langs = [lang for lang in REQUIRED_LOCALES[1:] if key not in locale_keys[lang]]
            if missing_langs:
                medium.append(
                    {
                        "severity": "medium",
                        "app": app,
                        "key": key,
                        "paths": path_list,
                        "missing_in": missing_langs,
                    }
                )

    # Also: keys present in non-zh but absent in zh (shouldn't happen for menus)
    for app, key_map in sorted(menu_keys.items()):
        for key in key_map:
            if key in zh_keys:
                continue
            # already in high
            pass

    report = {
        "manifests": len(list(MANIFESTS.glob("*/manifest.json"))),
        "menu_keys": sum(len(v) for v in menu_keys.values()),
        "high": high,
        "medium": medium,
        "high_count": len(high),
        "medium_count": len(medium),
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(
            f"manifests={report['manifests']} menu_keys={report['menu_keys']} "
            f"high={report['high_count']} medium={report['medium_count']}"
        )
        if high:
            print("\n=== HIGH: missing in zh-CN (sidebar shows raw key) ===")
            for item in high:
                paths = ", ".join(item["paths"][:3])
                print(f"  [{item['app']}] {item['key']}  ({paths})")
        if medium:
            print("\n=== MEDIUM: present in zh-CN, missing in other locales ===")
            by_lang: dict[str, int] = defaultdict(int)
            for item in medium:
                for lang in item["missing_in"]:
                    by_lang[lang] += 1
            for lang, count in sorted(by_lang.items()):
                print(f"  {lang}: {count} keys")
            # sample first 30
            for item in medium[:30]:
                print(f"  [{item['app']}] {item['key']}  missing={','.join(item['missing_in'])}")
            if len(medium) > 30:
                print(f"  ... and {len(medium) - 30} more")

        if not high and not medium:
            print("OK: all manifest menu titles present in five locales.")

    severity_rank = {"high": 2, "medium": 1, "never": 0}
    fail_rank = severity_rank[args.fail_on]
    if fail_rank >= 2 and high:
        return 1
    if fail_rank >= 1 and (high or medium):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
