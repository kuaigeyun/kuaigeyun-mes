#!/usr/bin/env python3
"""Generate preset entity locale modules + code registry from backend preset configs."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = ROOT / "riveredge-backend" / "src"
FRONTEND = ROOT / "riveredge-frontend"
OUT_LOCALE = FRONTEND / "src" / "locales" / "generated" / "presetEntity"
OUT_REGISTRY = FRONTEND / "src" / "utils" / "generated" / "presetEntityRegistry.ts"
EN_JSON = Path(__file__).resolve().parent / "preset_entity_i18n_en.json"
DEFECT_NAME_EN_JSON = Path(__file__).resolve().parent / "operation_defect_name_en.json"

sys.path.insert(0, str(BACKEND_SRC))

from core.services.organization.department_service import DepartmentService  # noqa: E402
from core.services.authorization.position_service import PositionService  # noqa: E402
from core.services.authorization.role_service import RoleService  # noqa: E402
from core.services.approval.approval_process_service import ApprovalProcessService  # noqa: E402
from core.services.messaging.message_template_service import MessageTemplateService  # noqa: E402
from core.services.print.print_template_service import PRESET_PRINT_TEMPLATES  # noqa: E402
from apps.master_data.services.process_preset_catalog import INDUSTRY_PRESETS  # noqa: E402
from apps.kuaizhizao.print.preset_templates import KUAIZHIZAO_PRESET_PRINT_TEMPLATES  # noqa: E402
from apps.haoligo.print.preset_templates import HAOLIGO_PRESET_PRINT_TEMPLATES  # noqa: E402
from apps.haoligo.services.haoligo_message_template_registry import (  # noqa: E402
    HAOLIGO_MESSAGE_TEMPLATE_PRESETS,
)


def ts_escape(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def key(entity: str, code: str, field: str) -> str:
    return f"preset.{entity}.{code}.{field}"


def collect_manifest() -> dict[str, Any]:
    departments = {
        str(x["code"]): {"name": x["name"]} for x in DepartmentService.PRESET_DEPARTMENTS
    }
    positions = {str(x["code"]): {"name": x["name"]} for x in PositionService.PRESET_POSITIONS}
    roles = {
        str(x["code"]): {"name": x["name"], "desc": x.get("description") or ""}
        for x in RoleService.PRESET_ROLES
    }
    approval_processes = {
        str(x["code"]): {"name": x["name"], "desc": x.get("description") or x["name"]}
        for x in ApprovalProcessService.PRESET_APPROVAL_PROCESSES
    }
    message_templates: dict[str, dict[str, str]] = {}
    for item in MessageTemplateService.PRESET_MESSAGE_TEMPLATES:
        code = str(item["code"])
        message_templates[code] = {
            "name": item["name"],
            "desc": item.get("description") or "",
        }
    for item in HAOLIGO_MESSAGE_TEMPLATE_PRESETS:
        code = str(item["code"])
        message_templates[code] = {
            "name": item["name"],
            "desc": item.get("description") or "",
        }

    print_templates: dict[str, dict[str, str]] = {}
    for item in PRESET_PRINT_TEMPLATES:
        code = str(item["code"])
        print_templates[code] = {
            "name": item["name"],
            "desc": item.get("description") or "",
        }
    for item in KUAIZHIZAO_PRESET_PRINT_TEMPLATES:
        code = str(item["code"])
        print_templates[code] = {
            "name": item["name"],
            "desc": item.get("description") or "",
        }
    for item in HAOLIGO_PRESET_PRINT_TEMPLATES:
        code = str(item["code"])
        print_templates[code] = {
            "name": item["name"],
            "desc": item.get("description") or "",
        }

    operation_industries: dict[str, dict[str, str]] = {}
    operations: dict[str, dict[str, str]] = {}
    operation_defects: dict[str, dict[str, str]] = {}
    for ind in INDUSTRY_PRESETS:
        iid = str(ind["id"])
        operation_industries[iid] = {
            "name": ind["name"],
            "desc": ind.get("description") or "",
        }
        for op in ind.get("operations") or []:
            pk = str(op["preset_key"])
            operations[pk] = {"name": op["name"]}
            for idx, d in enumerate(op.get("defect_presets") or []):
                code = f"{pk}__d{idx:02d}"
                operation_defects[code] = {"name": d["name"]}

    return {
        "department": departments,
        "position": positions,
        "role": roles,
        "approvalProcess": approval_processes,
        "messageTemplate": message_templates,
        "printTemplate": print_templates,
        "operationIndustry": operation_industries,
        "operation": operations,
        "operationDefect": operation_defects,
    }


def build_entries(manifest: dict[str, Any], lang: str, en_data: dict[str, Any]) -> dict[str, str]:
    entries: dict[str, str] = {}
    for entity, items in manifest.items():
        en_entity = en_data.get(entity, {})
        for code, fields in items.items():
            en_fields = en_entity.get(code, {})
            for field, zh_val in fields.items():
                locale_field = "desc" if field == "desc" else field
                k = key(entity, code, locale_field)
                if lang == "zh-CN":
                    entries[k] = zh_val or ""
                else:
                    entries[k] = en_fields.get(locale_field, en_fields.get(field, zh_val)) or ""
    return entries


def write_ts_locale(path: Path, const_name: str, entries: dict[str, str]) -> None:
    lines = [
        "/** Auto-generated by scripts/generate_preset_entity_locale.py — do not edit manually */",
        f"const {const_name} = {{",
    ]
    for k in sorted(entries.keys()):
        lines.append(f"  '{ts_escape(k)}': '{ts_escape(entries[k])}',")
    lines.append("} as const;")
    lines.append("")
    lines.append(f"export default {const_name};")
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def write_registry(manifest: dict[str, Any]) -> None:
    lines = [
        "/** Auto-generated by scripts/generate_preset_entity_locale.py — do not edit manually */",
        "",
        "export type PresetEntityKind =",
        "  | 'department'",
        "  | 'position'",
        "  | 'role'",
        "  | 'approvalProcess'",
        "  | 'messageTemplate'",
        "  | 'printTemplate'",
        "  | 'operationIndustry'",
        "  | 'operation'",
        "  | 'operationDefect';",
        "",
    ]
    for entity, items in manifest.items():
        const = f"PRESET_{''.join(w.upper() if i else w for i, w in enumerate(entity))}_CODES"
        # camelCase to SCREAMING: approvalProcess -> APPROVAL_PROCESS
        import re

        snake = re.sub(r"(?<!^)(?=[A-Z])", "_", entity).upper()
        const = f"PRESET_{snake}_CODES"
        codes = sorted(items.keys())
        codes_str = ", ".join(f"'{ts_escape(c)}'" for c in codes)
        lines.append(f"export const {const} = new Set<string>([{codes_str}]);")
        lines.append("")

    lines.append("export const PRESET_ENTITY_CODE_SETS: Record<PresetEntityKind, ReadonlySet<string>> = {")
    for entity in manifest:
        import re

        snake = re.sub(r"(?<!^)(?=[A-Z])", "_", entity).upper()
        lines.append(f"  {entity!r}: PRESET_{snake}_CODES,")
    lines.append("};")
    lines.append("")

    # Unique operation names -> preset_key (for list rows without preset_key)
    name_to_keys: dict[str, list[str]] = {}
    for code, fields in manifest["operation"].items():
        name = fields.get("name", "")
        if name:
            name_to_keys.setdefault(name, []).append(code)
    unique = {n: ks[0] for n, ks in name_to_keys.items() if len(ks) == 1}
    pairs = ", ".join(f"'{ts_escape(n)}': '{ts_escape(pk)}'" for n, pk in sorted(unique.items()))
    lines.append(f"export const PRESET_OPERATION_UNIQUE_NAME_TO_KEY: Record<string, string> = {{{pairs}}};")
    lines.append("")

    OUT_REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    OUT_REGISTRY.write_text("\n".join(lines), encoding="utf-8")


def merge_operation_defect_en(manifest: dict[str, Any], en_data: dict[str, Any]) -> dict[str, Any]:
    """Map flat zh->en defect names onto operationDefect codes from manifest."""
    if not DEFECT_NAME_EN_JSON.exists():
        return en_data
    name_en = json.loads(DEFECT_NAME_EN_JSON.read_text(encoding="utf-8"))
    merged = {**en_data}
    op_defect_en: dict[str, dict[str, str]] = {}
    for code, fields in manifest.get("operationDefect", {}).items():
        zh_name = fields.get("name", "")
        op_defect_en[code] = {"name": name_en.get(zh_name, zh_name)}
    merged["operationDefect"] = op_defect_en
    return merged


def main() -> None:
    manifest = collect_manifest()
    en_data = json.loads(EN_JSON.read_text(encoding="utf-8")) if EN_JSON.exists() else {}
    en_data = merge_operation_defect_en(manifest, en_data)
    write_ts_locale(OUT_LOCALE / "zh-CN.ts", "presetEntityZhCN", build_entries(manifest, "zh-CN", en_data))
    write_ts_locale(OUT_LOCALE / "en-US.ts", "presetEntityEnUS", build_entries(manifest, "en-US", en_data))
    write_registry(manifest)
    total = sum(len(v) for v in manifest.values())
    print(f"Generated preset entity locales ({total} preset records across {len(manifest)} entity types)")


if __name__ == "__main__":
    main()
