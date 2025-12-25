"""
MRP计划 API 模块

提供MRP计划的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimrp.services.mrp_plan_service import MRPPlanService
from apps.kuaimrp.schemas.mrp_plan_schemas import (
    MRPPlanCreate, MRPPlanUpdate, MRPPlanResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/mrp-plans", tags=["MRP Plans"])


@router.post("", response_model=MRPPlanResponse, status_code=status.HTTP_201_CREATED, summary="创建MRP计划")
async def create_mrp_plan(
    data: MRPPlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建MRP计划
    
    - **plan_no**: 计划编号（必填，组织内唯一）
    - **plan_name**: 计划名称（必填）
    - **plan_type**: 计划类型（MRP、LRP）
    - **plan_date**: 计划日期（必填）
    """
    try:
        return await MRPPlanService.create_mrp_plan(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MRPPlanResponse], summary="获取MRP计划列表")
async def list_mrp_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="计划状态（过滤）"),
    plan_type: Optional[str] = Query(None, description="计划类型（过滤）")
):
    """
    获取MRP计划列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 计划状态（可选，用于过滤）
    - **plan_type**: 计划类型（可选）
    """
    return await MRPPlanService.list_mrp_plans(tenant_id, skip, limit, status, plan_type)


@router.get("/{plan_uuid}", response_model=MRPPlanResponse, summary="获取MRP计划详情")
async def get_mrp_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取MRP计划详情
    
    - **plan_uuid**: 计划UUID
    """
    try:
        return await MRPPlanService.get_mrp_plan_by_uuid(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{plan_uuid}", response_model=MRPPlanResponse, summary="更新MRP计划")
async def update_mrp_plan(
    plan_uuid: str,
    data: MRPPlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新MRP计划
    
    - **plan_uuid**: 计划UUID
    - **data**: 计划更新数据
    """
    try:
        return await MRPPlanService.update_mrp_plan(tenant_id, plan_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{plan_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除MRP计划")
async def delete_mrp_plan(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除MRP计划（软删除）
    
    - **plan_uuid**: 计划UUID
    """
    try:
        await MRPPlanService.delete_mrp_plan(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{plan_uuid}/calculate", response_model=MRPPlanResponse, summary="执行MRP计算")
async def calculate_mrp(
    plan_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    执行MRP计算
    
    - **plan_uuid**: 计划UUID
    """
    try:
        return await MRPPlanService.calculate_mrp(tenant_id, plan_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
