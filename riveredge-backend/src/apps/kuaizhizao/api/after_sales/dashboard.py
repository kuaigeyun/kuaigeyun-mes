"""售后服务看板 API"""

from fastapi import APIRouter, Depends

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.after_sales_service import AfterSalesDashboardResponse
from apps.kuaizhizao.services.after_sales_dashboard_service import AfterSalesDashboardService
from core.api.deps import get_current_tenant

router = APIRouter(
    prefix="/after-sales/dashboard",
    tags=["App - Kuaige Zhizao - After-sales Dashboard"],
    dependencies=[Depends(require_kuaizhizao_module_access("after-sales-dashboard"))],
)
_service = AfterSalesDashboardService()


@router.get("", response_model=AfterSalesDashboardResponse, summary="Get after-sales dashboard summary")
async def get_dashboard_summary(
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.get_summary(tenant_id)
