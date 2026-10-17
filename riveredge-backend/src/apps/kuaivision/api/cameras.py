"""相机台账 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from apps.kuaivision.schemas.vision import CameraCreate, CameraListResponse, CameraResponse, CameraUpdate
from apps.kuaivision.services.camera_service import CameraService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/cameras", tags=["App - KuaiVision - Cameras"])


@router.get(
    "",
    response_model=CameraListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:camera:read"))],
)
async def list_cameras(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
):
    items, total = await CameraService.list_cameras(tenant_id, page=page, page_size=page_size, q=q)
    return CameraListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=CameraResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaivision:camera:create"))],
)
async def create_camera(
    data: CameraCreate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await CameraService.create(tenant_id, data, user)


@router.get(
    "/{uuid}",
    response_model=CameraResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:camera:read"))],
)
async def get_camera(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await CameraService.get_by_uuid(tenant_id, uuid)


@router.put(
    "/{uuid}",
    response_model=CameraResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:camera:update"))],
)
async def update_camera(
    uuid: str,
    data: CameraUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await CameraService.update(tenant_id, uuid, data, user)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaivision:camera:delete"))],
)
async def delete_camera(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    await CameraService.soft_delete(tenant_id, uuid, user)
