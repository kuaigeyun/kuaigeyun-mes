#!/usr/bin/env python3
"""Wire batch4 help views (excludes HaoliGO)."""
from __future__ import annotations

import re
from pathlib import Path

from batch4_help_manifest import DOC_WIRE, LIST_WIRE, MODULE_WIRE
from wire_batch3_document_help import (
    compute_import_path,
    compute_list_import_path,
    ensure_import,
    patch_view_types_doc,
    patch_view_types_list,
    wire_doc,
    wire_list,
)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"


def wire_module(rel: str, module_key: str) -> bool:
    path = SRC / rel
    if not path.exists():
        print(f"SKIP missing {rel}")
        return False
    text = path.read_text(encoding="utf-8")
    if f'moduleHelpKey="{module_key}"' in text:
        return False
    match = re.search(r"<ModuleCenterLayout\n", text)
    if not match:
        match = re.search(r"<ModuleCenterLayout\s+", text)
    if not match:
        print(f"SKIP no ModuleCenterLayout {rel}")
        return False
    old = match.group(0)
    insert = old if old.endswith("\n") else old
    new_fragment = f"<ModuleCenterLayout\n      moduleHelpKey=\"{module_key}\"\n"
    if old == "<ModuleCenterLayout\n":
        new_text = text.replace(old, new_fragment, 1)
    else:
        new_text = text.replace("<ModuleCenterLayout", f"<ModuleCenterLayout\n      moduleHelpKey=\"{module_key}\"", 1)
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    print(f"WIRED MODULE {rel} -> {module_key}")
    return True


def main() -> None:
    doc_n = sum(1 for rel, prop, _slug, _t, _p in DOC_WIRE if wire_doc(rel, prop))
    list_n = sum(1 for rel, key, _t, _p in LIST_WIRE if wire_list(rel, key))
    mod_n = sum(1 for rel, key in MODULE_WIRE if wire_module(rel, key))
    print(f"Done. Documents {doc_n}/{len(DOC_WIRE)}, Lists {list_n}/{len(LIST_WIRE)}, Modules {mod_n}/{len(MODULE_WIRE)}")


if __name__ == "__main__":
    main()
