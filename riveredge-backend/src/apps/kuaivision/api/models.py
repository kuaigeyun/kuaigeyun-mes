"""模型制品 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from apps.kuaivision.schemas.vision import (
    ModelArtifactCreate,
    ModelArtifactListResponse,
    ModelArtifactResponse,
    ModelArtifactUpdate,
)
from apps.kuaivision.services.model_artifact_service import ModelArtifactService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/models", tags=["App - KuaiVision - Models"])


@router.get(
    "",
    response_model=ModelArtifactListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:model:read"))],
)
async def list_models(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
):
    items, total = await ModelArtifactService.list_items(
        tenant_id, page=page, page_size=page_size, q=q
    )
    return ModelArtifactListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=ModelArtifactResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaivision:model:create"))],
)
async def create_model(
    data: ModelArtifactCreate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await ModelArtifactService.create(tenant_id, data, user)


@router.get(
    "/{uuid}",
    response_model=ModelArtifactResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:model:read"))],
)
async def get_model(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await ModelArtifactService.get_response(tenant_id, uuid)


@router.put(
    "/{uuid}",
    response_model=ModelArtifactResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:model:update"))],
)
async def update_model(
    uuid: str,
    data: ModelArtifactUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await ModelArtifactService.update(tenant_id, uuid, data, user)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaivision:model:delete"))],
)
async def delete_model(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    await ModelArtifactService.soft_delete(tenant_id, uuid, user)
