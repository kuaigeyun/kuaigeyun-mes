"""
仪表盘 API

Author: RiverEdge Team
Date: 2026-05-28
"""

from fastapi import APIRouter, Depends, HTTPException, status

from apps.kuaiplm.schemas.change_desk import DashboardSummaryResponse
from apps.kuaiplm.services.dashboard_service import DashboardService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/dashboard", tags=["App - Kuaiplm - Dashboard"])
service = DashboardService()


@router.get("/summary", response_model=DashboardSummaryResponse, summary="Dashboard summary")
async def get_summary(
    _auth=Depends(require_access("kuaiplm.dashboard", "read", required_permissions=["kuaiplm:dashboard:read"])),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    user_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
    return await service.get_summary(tenant_id, user_id=current_user.id, user_name=user_name)
