"""交付项目流程排单 API"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import DeliveryScheduleListEnvelope
from apps.kuaizhizao.services.delivery_project_service import DeliveryProjectService
from core.api.deps import get_current_tenant

router = APIRouter(
    prefix="/delivery-schedules",
    tags=["App - Kuaige Zhizao - Delivery Schedules"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-follow-up"))],
)

_service = DeliveryProjectService()


@router.get("", response_model=DeliveryScheduleListEnvelope, summary="List delivery project schedules")
async def list_schedules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_schedules(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        status=status,
    )
