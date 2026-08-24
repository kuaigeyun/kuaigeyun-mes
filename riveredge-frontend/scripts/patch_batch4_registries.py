#!/usr/bin/env python3
"""Patch TS registries for batch4 help keys."""
from __future__ import annotations

import re
from pathlib import Path

from batch4_help_manifest import BATCH4_DOC_REGISTRY, BATCH4_LIST_PAGE_KEYS, MODULE_WIRE

ROOT = Path(__file__).resolve().parents[1]
REG_LIST = ROOT / "src/components/page-help-wiki/richListPageHelpRegistry.ts"
REG_DOC = ROOT / "src/components/page-help-wiki/documentListHelpRegistry.ts"
REG_MODULE = ROOT / "src/components/page-help-wiki/richModuleCenterHelpRegistry.ts"


def _append_union_keys(text: str, marker: str, keys: list[str]) -> str:
    idx = text.find(marker)
    if idx < 0:
        raise RuntimeError(f"marker not found: {marker}")
    return text[:idx] + "".join(f"\n  | '{k}'" for k in keys) + text[idx:]


def _append_array_keys(text: str, marker: str, keys: list[str]) -> str:
    idx = text.find(marker)
    if idx < 0:
        raise RuntimeError(f"marker not found: {marker}")
    return text[:idx] + "".join(f"\n  '{k}'," for k in keys) + text[idx:]


def patch_list_registry() -> None:
    text = REG_LIST.read_text(encoding="utf-8")
    existing = set(re.findall(r"'([^']+)'", text))
    to_add = [k for k in BATCH4_LIST_PAGE_KEYS if k not in existing]
    if not to_add:
        print("List registry: no new keys")
        return

    text = _append_union_keys(text, "\n  | 'kuaicaiwu.marginReport';", to_add)
    text = _append_array_keys(text, "\n  'kuaicaiwu.marginReport',\n];", to_add)
    text = _append_array_keys(text, "\n  'kuaicaiwu.marginReport': 'standard',\n};", to_add)
    REG_LIST.write_text(text, encoding="utf-8")
    print(f"List registry: added {len(to_add)} keys")


def patch_doc_registry() -> None:
    text = REG_DOC.read_text(encoding="utf-8")
    marker = "  periodClose: 'period-close',\n} as const;"
    if marker not in text:
        raise RuntimeError("documentListHelpRegistry.ts marker not found")
    existing_props = set(re.findall(r"^\s+(\w+):", text, re.MULTILINE))
    lines = []
    for prop, slug in BATCH4_DOC_REGISTRY.items():
        if prop in existing_props:
            continue
        lines.append(f"  {prop}: '{slug}',")
    if not lines:
        print("Doc registry: no new keys")
        return
    insert = "\n  // batch4\n" + "\n".join(lines) + "\n"
    text = text.replace(marker, insert + marker)
    REG_DOC.write_text(text, encoding="utf-8")
    print(f"Doc registry: added {len(lines)} keys")


def patch_module_registry() -> None:
    text = REG_MODULE.read_text(encoding="utf-8")
    if "'plan'" in text:
        print("Module registry: plan exists")
        return
    text = text.replace("  | 'haoligo';", "  | 'haoligo'\n  | 'plan';")
    text = text.replace("  'haoligo',\n];", "  'haoligo',\n  'plan',\n];")
    REG_MODULE.write_text(text, encoding="utf-8")
    print("Module registry: added plan")


def main() -> None:
    patch_list_registry()
    patch_doc_registry()
    patch_module_registry()


if __name__ == "__main__":
    main()
