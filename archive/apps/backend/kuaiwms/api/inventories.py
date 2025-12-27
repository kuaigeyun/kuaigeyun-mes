"""
库存 API 模块

提供库存的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiwms.services.inventory_service import InventoryService
from apps.kuaiwms.schemas.inventory_schemas import InventoryResponse
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/inventories", tags=["Inventories"])


@router.get("", response_model=List[InventoryResponse], summary="获取库存列表")
async def list_inventories(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    material_id: Optional[int] = Query(None, description="物料ID（过滤）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（过滤）"),
    location_id: Optional[int] = Query(None, description="库位ID（过滤）")
):
    """
    获取库存列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **material_id**: 物料ID（可选，用于过滤）
    - **warehouse_id**: 仓库ID（可选）
    - **location_id**: 库位ID（可选）
    """
    return await InventoryService.list_inventories(tenant_id, skip, limit, material_id, warehouse_id, location_id)


@router.get("/{inventory_uuid}", response_model=InventoryResponse, summary="获取库存详情")
async def get_inventory(
    inventory_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取库存详情
    
    - **inventory_uuid**: 库存UUID
    """
    try:
        return await InventoryService.get_inventory_by_uuid(tenant_id, inventory_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
