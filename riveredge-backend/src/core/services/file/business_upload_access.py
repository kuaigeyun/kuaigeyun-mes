"""业务附件上传：category 白名单 → 模块写权限（create / update 等），替代强依赖 system.file:create。"""

from __future__ import annotations

from typing import Final

# category → 满足其一即可上传（新建/编辑业务单据时均可传附件）
BUSINESS_FILE_UPLOAD_PERMISSIONS: Final[dict[str, tuple[str, ...]]] = {
    "haoligo_equipment": (
        "haoligo:equipment-ledger:create",
        "haoligo:equipment-ledger:update",
    ),
    "haoligo_equipment_upkeep": (
        "haoligo:equipment-documents-upkeep-sheet:create",
        "haoligo:equipment-documents-upkeep-sheet:update",
    ),
    "haoligo_equipment_upkeep_complete": (
        "haoligo:equipment-documents-upkeep-complete:create",
        "haoligo:equipment-documents-upkeep-complete:update",
    ),
    "haoligo_equipment_spot_check": (
        "haoligo:equipment-documents-spot-check:create",
        "haoligo:equipment-documents-spot-check:update",
    ),
    "haoligo_equipment_route_patrol": (
        "haoligo:equipment-documents-route-patrol:create",
        "haoligo:equipment-documents-route-patrol:update",
    ),
    "haoligo_patrol_hazard": (
        "haoligo:patrol-hazards:create",
        "haoligo:patrol-hazards:update",
    ),
    "haoligo_mold_trial": (
        "haoligo:molds-documents-trial:create",
        "haoligo:molds-documents-trial:update",
    ),
    "haoligo_mold_maint": (
        "haoligo:molds-documents-upkeep:create",
        "haoligo:molds-documents-upkeep:update",
        "haoligo:molds-documents-repair:create",
        "haoligo:molds-documents-repair:update",
    ),
    "haoligo_mold_maint_complete": (
        "haoligo:molds-documents-upkeep-complete:create",
        "haoligo:molds-documents-upkeep-complete:update",
        "haoligo:molds-documents-repair-complete:create",
        "haoligo:molds-documents-repair-complete:update",
        "haoligo:molds-documents-upkeep:complete",
        "haoligo:molds-documents-repair:complete",
    ),
    "haoligo_mold_outsource_maint": (
        "haoligo:molds-documents-outsource-maintenance:create",
        "haoligo:molds-documents-outsource-maintenance:update",
    ),
    "haoligo_mold_outsource_maint_complete": (
        "haoligo:molds-documents-outsource-complete:create",
        "haoligo:molds-documents-outsource-complete:update",
        "haoligo:molds-documents-outsource-maintenance:complete",
    ),
}


def business_upload_permission_codes(category: str | None) -> list[str] | None:
    """返回 category 对应的业务写权限码；未登记则 None（须走 system.file:create）。"""
    key = (category or "").strip()
    if not key:
        return None
    perms = BUSINESS_FILE_UPLOAD_PERMISSIONS.get(key)
    if not perms:
        return None
    return list(perms)
