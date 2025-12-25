"""
生产计划 API 模块

提供生产计划的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiaps.services.production_plan_service import ProductionPlanService
from apps.kuaiaps.schemas.production_plan_schemas import (
    ProductionPlanCreate, ProductionPlanUpdate, ProductionPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/production-plans", tags=["ProductionPlans"])


@router.post("", response_model=ProductionPlanResponse, status_code=status.HTTP_201_CREATED, summary="创建生产计划")
async def create_production_plan(
    data: ProductionPlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建生产计划"""
    try:
        return await ProductionPlanService.create_production_plan(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ProductionPlanResponse], summary="获取生产计划列表")
async def list_production_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="计划类型（过滤）"),
    priority: Optional[str] = Query(None, description="优先级（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取生产计划列表"""
    return await ProductionPlanService.list_production_plans(tenant_id, skip, limit, plan_type, priority, status)


@router.get("/{plan_uuid}", response_model=ProductionPlanResponse, summary="获取生产计划详情")
async def get_production_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取生产计划详情"""
    try:
        return await ProductionPlanService.get_production_plan_by_uuid(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{plan_uuid}", response_model=ProductionPlanResponse, summary="更新生产计划")
async def update_production_plan(
    plan_uuid: str,
    data: ProductionPlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新生产计划"""
    try:
        return await ProductionPlanService.update_production_plan(tenant_id, plan_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{plan_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除生产计划")
async def delete_production_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除生产计划"""
    try:
        await ProductionPlanService.delete_production_plan(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

