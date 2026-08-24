#!/usr/bin/env python3
"""Wire batch3 list pages with viewTypes help + buildListPageHelpViewConfig."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

IMPORT_LINE = "import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';"
IMPORT_LINE_PAGES = "import { buildListPageHelpViewConfig } from '../../../../components/page-help-wiki';"
IMPORT_LINE_APPS_MD = "import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';"

# (relative path from src, pageKey, import depth: 'apps' | 'pages')
WIRE_TARGETS: list[tuple[str, str, str]] = [
    ("apps/master-data/pages/supply-chain/customers/index.tsx", "masterData.customers", "apps"),
    ("apps/master-data/pages/supply-chain/suppliers/index.tsx", "masterData.suppliers", "apps"),
    ("apps/master-data/pages/supply-chain/partner-price-books/index.tsx", "masterData.partnerPriceBooks", "apps"),
    ("apps/master-data/pages/materials/management.tsx", "masterData.materials", "apps"),
    ("apps/master-data/pages/materials/market-prices/index.tsx", "masterData.marketPrices", "apps"),
    ("apps/master-data/pages/materials/units/index.tsx", "masterData.units", "apps"),
    ("apps/master-data/pages/materials/batches/index.tsx", "masterData.batches", "apps"),
    ("apps/master-data/pages/materials/batch-rules/index.tsx", "masterData.batchRules", "apps"),
    ("apps/master-data/pages/materials/serials/index.tsx", "masterData.serials", "apps"),
    ("apps/master-data/pages/materials/serial-rules/index.tsx", "masterData.serialRules", "apps"),
    ("apps/master-data/pages/materials/variant-attributes/index.tsx", "masterData.variantAttributes", "apps"),
    ("apps/master-data/pages/process/routes/index.tsx", "masterData.routes", "apps"),
    ("apps/master-data/pages/process/operations/index.tsx", "masterData.operations", "apps"),
    ("apps/master-data/pages/process/sop/index.tsx", "masterData.sop", "apps"),
    ("apps/master-data/pages/process/drawings/index.tsx", "masterData.drawings", "apps"),
    ("apps/master-data/pages/process/drawing-where-used/index.tsx", "masterData.drawingWhereUsed", "apps"),
    ("apps/master-data/pages/process/defect-types/index.tsx", "masterData.defectTypes", "apps"),
    ("pages/system/users/list/index.tsx", "system.users", "pages"),
    ("pages/system/roles-permissions/index.tsx", "system.roles", "pages"),
    ("pages/system/menus/index.tsx", "system.menus", "pages"),
    ("pages/system/permissions/list/index.tsx", "system.permissions", "pages"),
    ("pages/system/custom-fields/list/index.tsx", "system.customFields", "pages"),
    ("pages/system/data-dictionaries/list/index.tsx", "system.dataDictionaries", "pages"),
    ("pages/system/languages/list/index.tsx", "system.languages", "pages"),
    ("pages/system/approval-processes/list/index.tsx", "system.approvalProcesses", "pages"),
    ("pages/system/messages/template/index.tsx", "system.messageTemplates", "pages"),
    ("pages/system/messages/config/index.tsx", "system.messageConfig", "pages"),
    ("pages/system/application-connections/list/index.tsx", "system.applicationConnections", "pages"),
    ("pages/system/apis/list/index.tsx", "system.apis", "pages"),
    ("pages/system/datasets/list/index.tsx", "system.datasets", "pages"),
    ("pages/system/report-templates/index.tsx", "system.reportTemplates", "pages"),
    ("pages/system/operation-logs/index.tsx", "system.operationLogs", "pages"),
    ("pages/system/login-logs/index.tsx", "system.loginLogs", "pages"),
    ("pages/system/invitation-codes/list/index.tsx", "system.invitationCodes", "pages"),
    ("pages/system/plugin-manager/index.tsx", "system.pluginManager", "pages"),
    ("pages/system/working-hours-configs/index.tsx", "system.workingHoursConfigs", "pages"),
    ("pages/system/equipment/list/index.tsx", "system.equipment", "pages"),
    ("pages/system/molds/list/index.tsx", "system.molds", "pages"),
]

IMPORT_BY_DEPTH = {
    "apps": IMPORT_LINE_APPS_MD,
    "pages": IMPORT_LINE_PAGES,
}


def compute_import_path(file_path: Path) -> str:
    rel = file_path.relative_to(SRC)
    depth = len(rel.parts) - 1
    return f"import {{ buildListPageHelpViewConfig }} from '{'../' * depth}components/page-help-wiki';"


def _last_import_insert_index(lines: list[str]) -> int:
    """Insert after the final complete import/export statement (handles multiline imports)."""
    insert_at = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith(("import ", "export ")):
            j = i
            while j < len(lines) and " from " not in lines[j]:
                j += 1
            if j < len(lines):
                insert_at = j + 1
            i = j + 1
            continue
        i += 1
    return insert_at


def ensure_import(text: str, import_line: str) -> str:
    if "buildListPageHelpViewConfig" in text:
        return text
    lines = text.splitlines(keepends=True)
    lines.insert(_last_import_insert_index(lines), import_line + "\n")
    return "".join(lines)


def patch_view_types(text: str, page_key: str) -> tuple[str, bool]:
    if "helpViewConfig={buildListPageHelpViewConfig" in text:
        return text, False

    help_props = f"\n          helpViewConfig={{buildListPageHelpViewConfig('{page_key}')}}"

    view_types_match = re.search(r"viewTypes=\{(\[[^\]]+\])\}", text)
    if view_types_match:
        raw = view_types_match.group(1)
        if "'help'" in raw or '"help"' in raw:
            if "helpViewConfig" not in text:
                text = text.replace(view_types_match.group(0), view_types_match.group(0) + help_props, 1)
                return text, True
            return text, False
        inner = raw[1:-1].strip()
        new_raw = f"{{[{inner}, 'help']}}"
        text = text.replace(view_types_match.group(0), view_types_match.group(0).replace(raw, f"[{inner}, 'help']"), 1)
        # fix replacement - simpler approach
        new_view = f"viewTypes={{[{inner}, 'help']}}{help_props}"
        text = text.replace(view_types_match.group(0), new_view, 1)
        return text, True

    # insert after first <UniTable occurrence's opening tag props - after columnPersistenceId or columns
    unitable_match = re.search(r"(<UniTable[^\n>]*\n(?:[^\n]*\n)*?\s+columnPersistenceId=[^\n]+\n)", text)
    if not unitable_match:
        unitable_match = re.search(r"(<UniTable<[^>]+>\n)", text)
    if not unitable_match:
        return text, False

    insert = f"        viewTypes={{['table', 'help']}}{help_props}\n"
    pos = unitable_match.end()
    text = text[:pos] + insert + text[pos:]
    return text, True


def wire_file(rel_path: str, page_key: str, _depth: str) -> bool:
    path = SRC / rel_path
    if not path.exists():
        print(f"SKIP missing {rel_path}")
        return False
    text = path.read_text(encoding="utf-8")
    import_line = compute_import_path(path)
    new_text = ensure_import(text, import_line)
    new_text, changed = patch_view_types(new_text, page_key)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print(f"WIRED {rel_path} -> {page_key}")
        return True
    print(f"UNCHANGED {rel_path}")
    return False


def main() -> None:
    wired = 0
    for rel, key, depth in WIRE_TARGETS:
        if wire_file(rel, key, depth):
            wired += 1
    print(f"Done. Wired {wired}/{len(WIRE_TARGETS)} files.")


if __name__ == "__main__":
    main()
