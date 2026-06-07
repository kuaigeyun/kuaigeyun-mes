"""好力 GO — 移动端聚合 API（启动角标等）。"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.services.mobile_workbench import resolve_mobile_workbench
from apps.haoligo.services.trial_sheet_side_effects import count_pending_trial_failure_exceptions
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/mobile",
    tags=["App · HaoliGO · 移动端"],
)


class MobileBootstrapOut(BaseModel):
    pending_audit_count: int = Field(description="当前用户外协完修单待审核数量")
    trial_failed_count: int = Field(description="待处理试模/试产不合格单数量（角标参考，不含已确认收回）")


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


@router.get("/bootstrap", response_model=MobileBootstrapOut, summary="移动端启动聚合")
async def get_mobile_bootstrap(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
) -> MobileBootstrapOut:
    pending_audit_count = await (
        tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
        .filter(applicant_user_id=user.id, sheet_status="待审核")
        .count()
    )

    trial_failed_count = await count_pending_trial_failure_exceptions(tenant_id)

    return MobileBootstrapOut(
        pending_audit_count=pending_audit_count,
        trial_failed_count=trial_failed_count,
    )


@router.get("/workbench", response_model=list[MobileWorkbenchSectionOut], summary="移动端工作台导航")
async def get_mobile_workbench(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    scope: Annotated[str, Query(description="home | approval | mold_menu")] = "home",
) -> list[MobileWorkbenchSectionOut]:
    sections: list[dict[str, Any]] = await resolve_mobile_workbench(
        tenant_id=tenant_id,
        user=user,
        scope=scope,
    )
    return [MobileWorkbenchSectionOut.model_validate(s) for s in sections]
