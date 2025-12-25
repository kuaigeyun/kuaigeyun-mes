"""
预算差异 API 模块

提供预算差异的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.budget_variance_service import BudgetVarianceService
from apps.kuaiepm.schemas.budget_variance_schemas import (
    BudgetVarianceCreate, BudgetVarianceUpdate, BudgetVarianceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/budget-variance", tags=["Budget Variances"])


@router.post("", response_model=BudgetVarianceResponse, summary="创建预算差异")
async def create_budgetvariance(
    data: BudgetVarianceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建预算差异"""
    try:
        return await BudgetVarianceService.create_budgetvariance(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[BudgetVarianceResponse], summary="获取预算差异列表")
async def list_budgetvariances(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取预算差异列表"""
    return await BudgetVarianceService.list_budgetvariances(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=BudgetVarianceResponse, summary="获取预算差异详情")
async def get_budgetvariance(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取预算差异详情"""
    try:
        return await BudgetVarianceService.get_budgetvariance_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=BudgetVarianceResponse, summary="更新预算差异")
async def update_budgetvariance(
    obj_uuid: str,
    data: BudgetVarianceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新预算差异"""
    try:
        return await BudgetVarianceService.update_budgetvariance(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除预算差异")
async def delete_budgetvariance(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除预算差异（软删除）"""
    try:
        await BudgetVarianceService.delete_budgetvariance(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
