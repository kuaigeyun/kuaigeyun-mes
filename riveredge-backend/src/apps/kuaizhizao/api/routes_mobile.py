"""快制造 — 移动端 H5 聚合 API（企微工作台入口）。"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from apps.kuaizhizao.models.equipment_fault import EquipmentFault
from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
from apps.kuaizhizao.services.mobile_workbench import resolve_mobile_workbench
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/mobile",
    tags=["App · Kuaige Zhizao · 移动端"],
)


class MobileWorkbenchEntryOut(BaseModel):
    key: str
    label: str
    route: str
    icon: str
    icon_group: str | None = None
    solo_row: bool = False


class MobileWorkbenchSectionOut(BaseModel):
    key: str
    title: str
    entries: list[MobileWorkbenchEntryOut]


class MobileEquipmentBootstrapOut(BaseModel):
    pending_fault_count: int = Field(description="待处理设备故障数量")
    overdue_maintenance_reminder_count: int = Field(description="逾期未处理保养提醒数量")


@router.get("/bootstrap", response_model=MobileEquipmentBootstrapOut, summary="设备 H5 启动角标")
async def get_mobile_bootstrap(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
) -> MobileEquipmentBootstrapOut:
    pending_fault_count = await EquipmentFault.filter(
        tenant_id=tenant_id,
        status="待处理",
        deleted_at__isnull=True,
    ).count()
    overdue_maintenance_reminder_count = await MaintenanceReminder.filter(
        tenant_id=tenant_id,
        reminder_type="overdue",
        is_handled=False,
        deleted_at__isnull=True,
    ).count()
    return MobileEquipmentBootstrapOut(
        pending_fault_count=pending_fault_count,
        overdue_maintenance_reminder_count=overdue_maintenance_reminder_count,
    )


@router.get("/workbench", response_model=list[MobileWorkbenchSectionOut], summary="移动端工作台导航")
async def get_mobile_workbench(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    scope: Annotated[str, Query(description="equipment 等 scope 键")] = "equipment",
) -> list[MobileWorkbenchSectionOut]:
    sections: list[dict[str, Any]] = await resolve_mobile_workbench(
        tenant_id=tenant_id,
        user=user,
        scope=scope,
    )
    return [MobileWorkbenchSectionOut.model_validate(s) for s in sections]
