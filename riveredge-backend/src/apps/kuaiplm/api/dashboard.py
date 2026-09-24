"""
仪表盘 API

Author: RiverEdge Team
Date: 2026-05-28
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaiplm.schemas.change_desk import DashboardSummaryResponse
from apps.kuaiplm.schemas.rd_project import PendingInboxListResponse
from apps.kuaiplm.services.dashboard_service import DashboardService
from apps.kuaiplm.services.pending_inbox_service import PendingInboxService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/dashboard", tags=["App - Kuaiplm - Dashboard"])
service = DashboardService()
inbox_service = PendingInboxService()


@router.get("/summary", response_model=DashboardSummaryResponse, summary="Dashboard summary")
async def get_summary(
    _auth=Depends(require_permission_codes("kuaiplm:dashboard:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    user_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None)
    return await service.get_summary(tenant_id, user_id=current_user.id, user_name=user_name)


@router.get(
    "/pending-inbox",
    response_model=PendingInboxListResponse,
    summary="Cross-project pending docs (wave-1)",
)
async def list_pending_inbox(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    project_id: Optional[int] = Query(None),
    doc_type: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaiplm:dashboard:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await inbox_service.list(
        tenant_id,
        project_id=project_id,
        doc_type=doc_type,
        skip=skip,
        limit=limit,
    )
