"""好力 GO 单据资源权限码（与 manifest 一致；非平台审批流）。

命名中的 workflow 仅指单据间业务衔接（如外协维保 → 完修），审核为各单 sheet_status 简易处理。
"""

from __future__ import annotations

# 资源前缀（app:module，与 manifest permissions / require_module_access 一致）
RESOURCE_MOLD_TRIAL = "haoligo:molds-documents-trial"
RESOURCE_MOLD_UPKEEP = "haoligo:molds-documents-upkeep"
RESOURCE_MOLD_UPKEEP_COMPLETE = "haoligo:molds-documents-upkeep-complete"
RESOURCE_MOLD_REPAIR = "haoligo:molds-documents-repair"
RESOURCE_MOLD_REPAIR_COMPLETE = "haoligo:molds-documents-repair-complete"
RESOURCE_OUTSOURCE_MAINTENANCE = "haoligo:molds-documents-outsource-maintenance"
RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE = "haoligo:molds-documents-outsource-complete"


def _code(resource: str, action: str) -> str:
    return f"{resource.strip()}:{action.strip().lower()}"


def permission_codes_for_complete_create(*, source_resource: str, target_resource: str) -> list[str]:
    """
    创建「完修单」时满足其一即可：
    - 目标单据 create（完整新建权限）
    - 来源单据 complete（仅发起完修，不可编辑来源单）
    """
    return [
        _code(target_resource, "create"),
        _code(source_resource, "complete"),
    ]


OUTSOURCE_COMPLETE_CREATE_PERMISSIONS = permission_codes_for_complete_create(
    source_resource=RESOURCE_OUTSOURCE_MAINTENANCE,
    target_resource=RESOURCE_OUTSOURCE_MAINTENANCE_COMPLETE,
)

UPKEEP_COMPLETE_CREATE_PERMISSIONS = permission_codes_for_complete_create(
    source_resource=RESOURCE_MOLD_UPKEEP,
    target_resource=RESOURCE_MOLD_UPKEEP_COMPLETE,
)

REPAIR_COMPLETE_CREATE_PERMISSIONS = permission_codes_for_complete_create(
    source_resource=RESOURCE_MOLD_REPAIR,
    target_resource=RESOURCE_MOLD_REPAIR_COMPLETE,
)
