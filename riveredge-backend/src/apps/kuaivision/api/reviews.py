"""人工复核 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from apps.kuaivision.schemas.vision import ReviewComplete, ReviewTaskDetail, ReviewTaskListResponse
from apps.kuaivision.services.review_service import ReviewService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/reviews", tags=["App - KuaiVision - Reviews"])


@router.get(
    "",
    response_model=ReviewTaskListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:review:read"))],
)
async def list_reviews(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
):
    items, total = await ReviewService.list_tasks(
        tenant_id, page=page, page_size=page_size, status=status
    )
    return ReviewTaskListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get(
    "/{uuid}",
    response_model=ReviewTaskDetail,
    dependencies=[Depends(require_permission_codes("kuaivision:review:read"))],
)
async def get_review(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await ReviewService.get_detail(tenant_id, uuid)


@router.post(
    "/{uuid}/complete",
    response_model=ReviewTaskDetail,
    dependencies=[Depends(require_permission_codes("kuaivision:review:update"))],
)
async def complete_review(
    uuid: str,
    data: ReviewComplete,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await ReviewService.complete(tenant_id, uuid, data, user)
