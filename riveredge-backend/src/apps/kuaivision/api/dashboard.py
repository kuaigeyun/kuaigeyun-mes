"""视觉中心汇总。"""

from fastapi import APIRouter, Depends

from apps.kuaivision.schemas.vision import DashboardSummary
from apps.kuaivision.services.inspection_service import InspectionService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant

router = APIRouter(prefix="/dashboard", tags=["App - KuaiVision - Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummary,
    dependencies=[Depends(require_permission_codes("kuaivision:workspace:read"))],
)
async def dashboard_summary(tenant_id: int = Depends(get_current_tenant)):
    return await InspectionService.dashboard_summary(tenant_id)
