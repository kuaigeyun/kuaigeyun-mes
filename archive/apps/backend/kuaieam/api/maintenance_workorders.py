"""
维护工单 API 模块

提供维护工单的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaieam.services.maintenance_workorder_service import MaintenanceWorkOrderService
from apps.kuaieam.schemas.maintenance_workorder_schemas import (
    MaintenanceWorkOrderCreate, MaintenanceWorkOrderUpdate, MaintenanceWorkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/maintenance-workorders", tags=["MaintenanceWorkOrders"])


@router.post("", response_model=MaintenanceWorkOrderResponse, status_code=status.HTTP_201_CREATED, summary="创建维护工单")
async def create_maintenance_workorder(
    data: MaintenanceWorkOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建维护工单"""
    try:
        return await MaintenanceWorkOrderService.create_maintenance_workorder(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MaintenanceWorkOrderResponse], summary="获取维护工单列表")
async def list_maintenance_workorders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    workorder_type: Optional[str] = Query(None, description="工单类型（过滤）"),
    status: Optional[str] = Query(None, description="工单状态（过滤）")
):
    """获取维护工单列表"""
    return await MaintenanceWorkOrderService.list_maintenance_workorders(tenant_id, skip, limit, workorder_type, status)


@router.get("/{workorder_uuid}", response_model=MaintenanceWorkOrderResponse, summary="获取维护工单详情")
async def get_maintenance_workorder(
    workorder_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取维护工单详情"""
    try:
        return await MaintenanceWorkOrderService.get_maintenance_workorder_by_uuid(tenant_id, workorder_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{workorder_uuid}", response_model=MaintenanceWorkOrderResponse, summary="更新维护工单")
async def update_maintenance_workorder(
    workorder_uuid: str,
    data: MaintenanceWorkOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新维护工单"""
    try:
        return await MaintenanceWorkOrderService.update_maintenance_workorder(tenant_id, workorder_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{workorder_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除维护工单")
async def delete_maintenance_workorder(
    workorder_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除维护工单"""
    try:
        await MaintenanceWorkOrderService.delete_maintenance_workorder(tenant_id, workorder_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
