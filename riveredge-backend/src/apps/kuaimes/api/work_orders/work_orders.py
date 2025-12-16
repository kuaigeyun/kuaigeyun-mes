"""
工单 API 模块

提供工单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimes.services.work_order_service import WorkOrderService
from apps.kuaimes.schemas.work_order_schemas import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/work-orders", tags=["Work Orders"])


@router.post("", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED, summary="创建工单")
async def create_work_order(
    data: WorkOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建工单"""
    try:
        return await WorkOrderService.create_work_order(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[WorkOrderResponse], summary="获取工单列表")
async def list_work_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="工单状态（过滤）"),
    order_uuid: Optional[str] = Query(None, description="生产订单UUID（过滤）")
):
    """获取工单列表"""
    return await WorkOrderService.list_work_orders(tenant_id, skip, limit, status, order_uuid)


@router.get("/{work_order_uuid}", response_model=WorkOrderResponse, summary="获取工单详情")
async def get_work_order(
    work_order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取工单详情"""
    try:
        return await WorkOrderService.get_work_order_by_uuid(tenant_id, work_order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{work_order_uuid}", response_model=WorkOrderResponse, summary="更新工单")
async def update_work_order(
    work_order_uuid: str,
    data: WorkOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新工单"""
    try:
        return await WorkOrderService.update_work_order(tenant_id, work_order_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{work_order_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除工单")
async def delete_work_order(
    work_order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除工单（软删除）"""
    try:
        await WorkOrderService.delete_work_order(tenant_id, work_order_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
