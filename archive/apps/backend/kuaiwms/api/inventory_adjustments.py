"""
库存调整 API 模块

提供库存调整的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiwms.services.inventory_adjustment_service import InventoryAdjustmentService
from apps.kuaiwms.schemas.inventory_adjustment_schemas import (
    InventoryAdjustmentCreate, InventoryAdjustmentUpdate, InventoryAdjustmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/inventory-adjustments", tags=["Inventory Adjustments"])


@router.post("", response_model=InventoryAdjustmentResponse, status_code=status.HTTP_201_CREATED, summary="创建库存调整")
async def create_inventory_adjustment(
    data: InventoryAdjustmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建库存调整
    
    - **adjustment_no**: 调整单编号（必填，组织内唯一）
    - **adjustment_date**: 调整日期（必填）
    - **warehouse_id**: 仓库ID（必填）
    - **adjustment_type**: 调整类型（必填）
    - **adjustment_reason**: 调整原因（必填）
    """
    try:
        return await InventoryAdjustmentService.create_inventory_adjustment(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[InventoryAdjustmentResponse], summary="获取库存调整列表")
async def list_inventory_adjustments(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="调整状态（过滤）"),
    warehouse_id: Optional[int] = Query(None, description="仓库ID（过滤）")
):
    """
    获取库存调整列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 调整状态（可选，用于过滤）
    - **warehouse_id**: 仓库ID（可选）
    """
    return await InventoryAdjustmentService.list_inventory_adjustments(tenant_id, skip, limit, status, warehouse_id)


@router.get("/{adjustment_uuid}", response_model=InventoryAdjustmentResponse, summary="获取库存调整详情")
async def get_inventory_adjustment(
    adjustment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取库存调整详情
    
    - **adjustment_uuid**: 调整UUID
    """
    try:
        return await InventoryAdjustmentService.get_inventory_adjustment_by_uuid(tenant_id, adjustment_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{adjustment_uuid}", response_model=InventoryAdjustmentResponse, summary="更新库存调整")
async def update_inventory_adjustment(
    adjustment_uuid: str,
    data: InventoryAdjustmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新库存调整
    
    - **adjustment_uuid**: 调整UUID
    - **data**: 调整更新数据
    """
    try:
        return await InventoryAdjustmentService.update_inventory_adjustment(tenant_id, adjustment_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{adjustment_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除库存调整")
async def delete_inventory_adjustment(
    adjustment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除库存调整（软删除）
    
    - **adjustment_uuid**: 调整UUID
    """
    try:
        await InventoryAdjustmentService.delete_inventory_adjustment(tenant_id, adjustment_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{adjustment_uuid}/submit-approval", response_model=InventoryAdjustmentResponse, summary="提交库存调整审批")
async def submit_for_approval(
    adjustment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    process_code: str = Query(..., description="审批流程代码")
):
    """
    提交库存调整审批
    
    - **adjustment_uuid**: 调整UUID
    - **process_code**: 审批流程代码（如：inventory_adjustment_approval）
    """
    try:
        return await InventoryAdjustmentService.submit_for_approval(tenant_id, adjustment_uuid, process_code, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
