"""
服务工单 API 模块

提供服务工单的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.service_workorder_service import ServiceWorkOrderService
from apps.kuaicrm.schemas.service_workorder_schemas import (
    ServiceWorkOrderCreate, ServiceWorkOrderUpdate, ServiceWorkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/service-workorders", tags=["Service WorkOrders"])


@router.post("", response_model=ServiceWorkOrderResponse, summary="创建服务工单")
async def create_workorder(
    data: ServiceWorkOrderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建服务工单
    
    - **workorder_no**: 工单编号（必填，组织内唯一）
    - **workorder_type**: 工单类型（必填）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **service_content**: 服务内容（必填）
    - **priority**: 优先级（默认：普通）
    """
    try:
        return await ServiceWorkOrderService.create_workorder(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ServiceWorkOrderResponse], summary="获取服务工单列表")
async def list_workorders(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="工单状态（过滤）"),
    workorder_type: Optional[str] = Query(None, description="工单类型（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取服务工单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 工单状态（可选，用于过滤）
    - **workorder_type**: 工单类型（可选）
    - **customer_id**: 客户ID（可选）
    """
    return await ServiceWorkOrderService.list_workorders(tenant_id, skip, limit, status, workorder_type, customer_id)


@router.get("/{workorder_uuid}", response_model=ServiceWorkOrderResponse, summary="获取服务工单详情")
async def get_workorder(
    workorder_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取服务工单详情
    
    - **workorder_uuid**: 工单UUID
    """
    try:
        return await ServiceWorkOrderService.get_workorder_by_uuid(tenant_id, workorder_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{workorder_uuid}/assign", response_model=ServiceWorkOrderResponse, summary="分配服务工单")
async def assign_workorder(
    workorder_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    assigned_to: int = Query(..., description="分配给（用户ID）")
):
    """
    分配服务工单
    
    - **workorder_uuid**: 工单UUID
    - **assigned_to**: 分配给（用户ID）
    """
    try:
        return await ServiceWorkOrderService.assign_workorder(tenant_id, workorder_uuid, assigned_to)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{workorder_uuid}", response_model=ServiceWorkOrderResponse, summary="更新服务工单")
async def update_workorder(
    workorder_uuid: str,
    data: ServiceWorkOrderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新服务工单
    
    - **workorder_uuid**: 工单UUID
    - **data**: 工单更新数据
    """
    try:
        return await ServiceWorkOrderService.update_workorder(tenant_id, workorder_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{workorder_uuid}/close", response_model=ServiceWorkOrderResponse, summary="关闭服务工单")
async def close_workorder(
    workorder_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    execution_result: str = Query(..., description="执行结果")
):
    """
    关闭服务工单
    
    - **workorder_uuid**: 工单UUID
    - **execution_result**: 执行结果
    """
    try:
        return await ServiceWorkOrderService.close_workorder(tenant_id, workorder_uuid, execution_result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{workorder_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除服务工单")
async def delete_workorder(
    workorder_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除服务工单（软删除）
    
    - **workorder_uuid**: 工单UUID
    """
    try:
        await ServiceWorkOrderService.delete_workorder(tenant_id, workorder_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
