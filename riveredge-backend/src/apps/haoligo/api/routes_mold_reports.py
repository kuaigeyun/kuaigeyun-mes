"""好力 GO — 模具统计报表 API。"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from apps.haoligo.api._data_scope import (
    RESOURCE_OUTSOURCE_COMPLETE,
    apply_outsource_sheet_scope,
)
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from core.services.authorization.data_scope_service import DataScopeService
from infra.models.user import User

router = APIRouter(
    prefix="/molds/reports",
    tags=["App · HaoliGO · 模具报表"],
    dependencies=[Depends(require_module_access("haoligo", "molds-reports-maintenance-alert"))],
)


class MaintenanceUpkeepLastByMoldOut(BaseModel):
    items: dict[str, datetime] = Field(
        default_factory=dict,
        description="模具代号 → 最近一次保养完修时间（厂内 + 外协已通过，ISO 8601）",
    )


async def _is_external_partner_user(tenant_id: int, user: User) -> bool:
    if DataScopeService._admin_bypass(user):
        return False
    roles = await DataScopeService._load_active_roles(user.id, tenant_id)
    return any(
        (getattr(role, "role_type", "") or "").strip().lower() == "external"
        and (getattr(role, "external_partner_type", "") or "").strip()
        for role in roles
    )


def _collect_latest_from_line_items(
    items_map: dict[str, datetime],
    *,
    line_items: Any,
    upkeep_at: datetime | None,
) -> None:
    if upkeep_at is None or not isinstance(line_items, list):
        return
    for elem in line_items:
        if not isinstance(elem, dict):
            continue
        mold_code = str(elem.get("mold_code") or "").strip()
        if not mold_code:
            continue
        prev = items_map.get(mold_code)
        if prev is None or upkeep_at > prev:
            items_map[mold_code] = upkeep_at


@router.get(
    "/maintenance-upkeep-last-by-mold",
    response_model=MaintenanceUpkeepLastByMoldOut,
    summary="各模具最近保养完修时间（保养预警表聚合）",
)
async def get_maintenance_upkeep_last_by_mold(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> MaintenanceUpkeepLastByMoldOut:
    out: dict[str, datetime] = {}

    # 外协角色只看其授权范围内的外协完修数据，避免报表越权透出厂内维保信息。
    if not await _is_external_partner_user(tenant_id, current_user):
        inhouse_rows = await HaoligoMoldMaintenanceCompleteSheet.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            service_type="保养",
        ).all()
        for row in inhouse_rows:
            _collect_latest_from_line_items(
                out,
                line_items=getattr(row, "line_items", None),
                upkeep_at=getattr(row, "created_at", None),
            )

    outsource_qs = HaoligoMoldOutsourceMaintenanceCompleteSheet.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        sheet_status="已通过",
        service_type="保养",
    )
    outsource_qs = await apply_outsource_sheet_scope(
        outsource_qs,
        tenant_id=tenant_id,
        user=current_user,
        resource=RESOURCE_OUTSOURCE_COMPLETE,
    )
    outsource_rows = await outsource_qs.all()
    for row in outsource_rows:
        _collect_latest_from_line_items(
            out,
            line_items=getattr(row, "line_items", None),
            upkeep_at=getattr(row, "created_at", None),
        )
    return MaintenanceUpkeepLastByMoldOut(items=out)
