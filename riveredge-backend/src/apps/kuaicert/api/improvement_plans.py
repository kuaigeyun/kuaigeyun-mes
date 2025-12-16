"""
改进计划 API 模块

提供改进计划的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicert.services.improvement_plan_service import ImprovementPlanService
from apps.kuaicert.schemas.improvement_plan_schemas import (
    ImprovementPlanCreate, ImprovementPlanUpdate, ImprovementPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/improvement-plan", tags=["改进计划"])


@router.post("", response_model=ImprovementPlanResponse, summary="创建改进计划")
async def create_improvementplan(
    data: ImprovementPlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建改进计划"""
    try:
        return await ImprovementPlanService.create_improvementplan(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ImprovementPlanResponse], summary="获取改进计划列表")
async def list_improvementplans(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取改进计划列表"""
    return await ImprovementPlanService.list_improvementplans(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=ImprovementPlanResponse, summary="获取改进计划详情")
async def get_improvementplan(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取改进计划详情"""
    try:
        return await ImprovementPlanService.get_improvementplan_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=ImprovementPlanResponse, summary="更新改进计划")
async def update_improvementplan(
    obj_uuid: str,
    data: ImprovementPlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新改进计划"""
    try:
        return await ImprovementPlanService.update_improvementplan(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除改进计划")
async def delete_improvementplan(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除改进计划（软删除）"""
    try:
        await ImprovementPlanService.delete_improvementplan(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
