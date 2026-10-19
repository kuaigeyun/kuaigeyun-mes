"""视觉方案 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from apps.kuaivision.schemas.vision import (
    RecipeCreate,
    RecipeListResponse,
    RecipeResponse,
    RecipeUpdate,
    RecipeVersionCreate,
    RecipeVersionUpdate,
)
from apps.kuaivision.services.recipe_service import RecipeService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/recipes", tags=["App - KuaiVision - Recipes"])


@router.get(
    "",
    response_model=RecipeListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:read"))],
)
async def list_recipes(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    recipe_type: Optional[str] = None,
):
    items, total = await RecipeService.list_recipes(
        tenant_id, page=page, page_size=page_size, q=q, recipe_type=recipe_type
    )
    return RecipeListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:create"))],
)
async def create_recipe(
    data: RecipeCreate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await RecipeService.create(tenant_id, data, user)


@router.get(
    "/{uuid}",
    response_model=RecipeResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:read"))],
)
async def get_recipe(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await RecipeService.get_detail(tenant_id, uuid)


@router.put(
    "/{uuid}",
    response_model=RecipeResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:update"))],
)
async def update_recipe(
    uuid: str,
    data: RecipeUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await RecipeService.update(tenant_id, uuid, data, user)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:delete"))],
)
async def delete_recipe(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    await RecipeService.soft_delete(tenant_id, uuid, user)


@router.post(
    "/{uuid}/versions",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:update"))],
)
async def add_version(
    uuid: str,
    data: RecipeVersionCreate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await RecipeService.add_version(tenant_id, uuid, data, user)


@router.put(
    "/{uuid}/versions/{version_uuid}",
    response_model=RecipeResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:update"))],
)
async def update_version(
    uuid: str,
    version_uuid: str,
    data: RecipeVersionUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await RecipeService.update_version(tenant_id, uuid, version_uuid, data, user)


@router.post(
    "/{uuid}/versions/{version_uuid}/publish",
    response_model=RecipeResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:recipe:publish"))],
)
async def publish_version(
    uuid: str,
    version_uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await RecipeService.publish_version(tenant_id, uuid, version_uuid, user)
