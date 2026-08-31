"""交付中心 API"""

from fastapi import APIRouter, Depends

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import DeliveryDashboardResponse
from apps.kuaizhizao.services.delivery_project_service import DeliveryProjectService
from core.api.deps import get_current_tenant

router = APIRouter(
    prefix="/delivery-dashboard",
    tags=["App - Kuaige Zhizao - Delivery Dashboard"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-dashboard"))],
)

_service = DeliveryProjectService()


@router.get("", response_model=DeliveryDashboardResponse, summary="Delivery dashboard")
async def get_dashboard(tenant_id: int = Depends(get_current_tenant)):
    return await _service.get_dashboard(tenant_id)
