"""检测记录 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaivision.schemas.vision import (
    InspectionDetail,
    InspectionListResponse,
    PromoteSampleRequest,
    SampleSetResponse,
)
from apps.kuaivision.services.inspection_service import InspectionService
from apps.kuaivision.services.sample_service import SampleService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/inspections", tags=["App - KuaiVision - Inspections"])


@router.get(
    "",
    response_model=InspectionListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:inspection:read"))],
)
async def list_inspections(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    judgment: Optional[str] = None,
    station_code: Optional[str] = None,
    recipe_code: Optional[str] = None,
):
    items, total = await InspectionService.list_inspections(
        tenant_id,
        page=page,
        page_size=page_size,
        q=q,
        judgment=judgment,
        station_code=station_code,
        recipe_code=recipe_code,
    )
    return InspectionListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{uuid}",
    response_model=InspectionDetail,
    dependencies=[Depends(require_permission_codes("kuaivision:inspection:read"))],
)
async def get_inspection(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await InspectionService.get_detail(tenant_id, uuid)


@router.post(
    "/{uuid}/promote-sample",
    response_model=SampleSetResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:create"))],
)
async def promote_inspection_sample(
    uuid: str,
    data: PromoteSampleRequest,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await SampleService.promote_from_inspection(tenant_id, uuid, data, user)
