"""办公工作台 API。"""

from fastapi import APIRouter, Depends

from apps.kuaioa.services.workbench_service import WorkbenchService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/workbench", tags=["App - Kuaioa - Workbench"])
service = WorkbenchService()


@router.get("/summary", summary="Get OA workbench summary")
async def get_workbench_summary(
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.workbench", "read", required_permissions=["kuaioa:workbench:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    data = await service.get_summary(tenant_id, current_user.id)
    return {"data": data, "success": True}
