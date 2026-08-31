"""项目跟进表 API"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import DeliveryFollowUpListEnvelope
from apps.kuaizhizao.services.delivery_project_service import DeliveryProjectService
from core.api.deps import get_current_tenant

router = APIRouter(
    prefix="/delivery-follow-up",
    tags=["App - Kuaige Zhizao - Delivery Follow-up"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-follow-up"))],
)

_service = DeliveryProjectService()


@router.get("", response_model=DeliveryFollowUpListEnvelope, summary="Delivery follow-up board")
async def list_follow_up(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_follow_up(
        tenant_id, skip=skip, limit=limit, keyword=keyword, status=status
    )
