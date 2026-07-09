"""好力 GO 单据打印：document_type ↔ 功能权限模块。"""

from __future__ import annotations

# 打印 API document_type → manifest module_code（与菜单 permission 一致）
HAOLIGO_PRINT_DOCUMENT_TYPE_MODULE: dict[str, str] = {
    "equipment_spot_check": "equipment-documents-spot-check",
    "equipment_upkeep_complete": "equipment-documents-upkeep-complete",
    "mold_maintenance_complete": "molds-documents-upkeep-complete",
    "mold_outsource_maintenance_complete": "molds-documents-outsource-complete",
    "finance_material_acceptance": "finance-invoice-verify",
}

# 角色权限树需展示「打印」的全部单据模块（含尚未接打印 API 的单据）
HAOLIGO_DOCUMENT_PRINT_MODULES: tuple[str, ...] = (
    "molds-documents-trial",
    "molds-documents-borrow-out",
    "molds-documents-return-in",
    "molds-documents-upkeep",
    "molds-documents-upkeep-complete",
    "molds-documents-repair",
    "molds-documents-repair-complete",
    "molds-documents-outsource-maintenance",
    "molds-documents-outsource-complete",
    "equipment-documents-spot-check",
    "equipment-documents-route-patrol",
    "equipment-documents-upkeep-sheet",
    "equipment-documents-upkeep-complete",
    "equipment-documents-output-record",
    "equipment-documents-status-adjustment",
    "finance-invoice-verify",
)


def haoligo_document_print_permission(module_code: str) -> str:
    from core.config.permission_contract import build_permission_code

    return build_permission_code("haoligo", module_code, "print")
