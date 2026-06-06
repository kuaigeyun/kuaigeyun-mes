"""好力 GO — 移动端聚合 API（启动角标、身份探测等）。"""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from apps.haoligo.api._data_scope import user_is_external_partner
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/mobile",
    tags=["App · HaoliGO · 移动端"],
)


class MobileBootstrapOut(BaseModel):
    is_outsource: bool = Field(description="是否按外协身份展示（模具 Tab 为主）")
    pending_audit_count: int = Field(description="当前用户外协完修单待审核数量")
    trial_failed_count: int = Field(description="租户内试模不合格单数量（角标参考）")
    vendor_id: Optional[str] = Field(None, description="外协厂商标识（预留）")


@router.get("/bootstrap", response_model=MobileBootstrapOut, summary="移动端启动聚合")
async def get_mobile_bootstrap(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
) -> MobileBootstrapOut:
    is_outsource = await user_is_external_partner(tenant_id, user)

    pending_audit_count = await (
        tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
        .filter(applicant_user_id=user.id, sheet_status="待审核")
        .count()
    )

    trial_failed_count = await (
        tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(trial_result="不合格").count()
    )

    return MobileBootstrapOut(
        is_outsource=is_outsource,
        pending_audit_count=pending_audit_count,
        trial_failed_count=trial_failed_count,
        vendor_id=None,
    )
