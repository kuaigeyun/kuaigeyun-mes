"""
成本中心 KPI API（快财务）
"""

from datetime import datetime

from fastapi import APIRouter, Depends

from apps.kuaicaiwu.api._kuaicaiwu_route_access import require_kuaicaiwu_module_access
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from core.utils.api_cache import cache_by_kwargs

router = APIRouter(
    prefix="/cost",
    tags=["App - Kuaicaiwu - Cost Center"],
    dependencies=[Depends(require_kuaicaiwu_module_access("cost-management-dashboard"))],
)


@router.get("/cost-summary", summary="Cost center summary")
@cache_by_kwargs(namespace="dashboard:cost_summary", ttl=60)
async def get_cost_summary(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """成本中心 KPI：待核算、已审核核算、本月核算次数。"""
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    pending = await CostCalculation.filter(
        tenant_id=tenant_id,
        calculation_status__in=["草稿", "draft"],
        deleted_at__isnull=True,
    ).count()
    approved = await CostCalculation.filter(
        tenant_id=tenant_id,
        calculation_status__in=["已审核", "已核算", "approved"],
        deleted_at__isnull=True,
    ).count()
    month_count = await CostCalculation.filter(
        tenant_id=tenant_id,
        created_at__gte=month_start,
        deleted_at__isnull=True,
    ).count()

    return {
        "pending_calculations": pending,
        "approved_calculations": approved,
        "month_calculations": month_count,
    }
