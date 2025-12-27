"""
计划调整 API 模块

提供计划调整的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiaps.services.plan_adjustment_service import PlanAdjustmentService
from apps.kuaiaps.schemas.plan_adjustment_schemas import (
    PlanAdjustmentCreate, PlanAdjustmentUpdate, PlanAdjustmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/plan-adjustments", tags=["PlanAdjustments"])


@router.post("", response_model=PlanAdjustmentResponse, status_code=status.HTTP_201_CREATED, summary="创建计划调整")
async def create_plan_adjustment(
    data: PlanAdjustmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建计划调整"""
    try:
        return await PlanAdjustmentService.create_plan_adjustment(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[PlanAdjustmentResponse], summary="获取计划调整列表")
async def list_plan_adjustments(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    adjustment_type: Optional[str] = Query(None, description="调整类型（过滤）"),
    approval_status: Optional[str] = Query(None, description="审批状态（过滤）"),
    adjustment_status: Optional[str] = Query(None, description="调整状态（过滤）")
):
    """获取计划调整列表"""
    return await PlanAdjustmentService.list_plan_adjustments(tenant_id, skip, limit, adjustment_type, approval_status, adjustment_status)


@router.get("/{adjustment_uuid}", response_model=PlanAdjustmentResponse, summary="获取计划调整详情")
async def get_plan_adjustment(
    adjustment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取计划调整详情"""
    try:
        return await PlanAdjustmentService.get_plan_adjustment_by_uuid(tenant_id, adjustment_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{adjustment_uuid}", response_model=PlanAdjustmentResponse, summary="更新计划调整")
async def update_plan_adjustment(
    adjustment_uuid: str,
    data: PlanAdjustmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新计划调整"""
    try:
        return await PlanAdjustmentService.update_plan_adjustment(tenant_id, adjustment_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{adjustment_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除计划调整")
async def delete_plan_adjustment(
    adjustment_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除计划调整"""
    try:
        await PlanAdjustmentService.delete_plan_adjustment(tenant_id, adjustment_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

