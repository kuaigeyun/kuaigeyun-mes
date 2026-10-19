"""样本库 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse

from apps.kuaivision.schemas.vision import (
    SampleExportPack,
    SampleSetCreate,
    SampleSetListResponse,
    SampleSetResponse,
    SampleSetUpdate,
)
from apps.kuaivision.services.sample_service import SampleService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/sample-sets", tags=["App - KuaiVision - Samples"])


@router.get(
    "",
    response_model=SampleSetListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:read"))],
)
async def list_sample_sets(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    recipe_code: Optional[str] = None,
):
    items, total = await SampleService.list_sets(
        tenant_id, page=page, page_size=page_size, q=q, recipe_code=recipe_code
    )
    return SampleSetListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=SampleSetResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:create"))],
)
async def create_sample_set(
    data: SampleSetCreate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await SampleService.create(tenant_id, data, user)


@router.get(
    "/{uuid}",
    response_model=SampleSetResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:read"))],
)
async def get_sample_set(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await SampleService.get_detail(tenant_id, uuid)


@router.put(
    "/{uuid}",
    response_model=SampleSetResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:update"))],
)
async def update_sample_set(
    uuid: str,
    data: SampleSetUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await SampleService.update(tenant_id, uuid, data, user)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:delete"))],
)
async def delete_sample_set(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    await SampleService.soft_delete(tenant_id, uuid, user)


@router.get(
    "/{uuid}/export-pack",
    response_model=SampleExportPack,
    dependencies=[Depends(require_permission_codes("kuaivision:sample:export"))],
)
async def export_sample_pack(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    pack = await SampleService.export_pack(tenant_id, uuid)
    return JSONResponse(
        content=pack.model_dump(mode="json"),
        headers={
            "Content-Disposition": f'attachment; filename="{pack.sample_set_code}-pack.json"',
        },
    )
