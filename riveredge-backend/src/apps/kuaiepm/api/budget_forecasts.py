"""
预算预测 API 模块

提供预算预测的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.budget_forecast_service import BudgetForecastService
from apps.kuaiepm.schemas.budget_forecast_schemas import (
    BudgetForecastCreate, BudgetForecastUpdate, BudgetForecastResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/budget-forecast", tags=["Budget Forecasts"])


@router.post("", response_model=BudgetForecastResponse, summary="创建预算预测")
async def create_budgetforecast(
    data: BudgetForecastCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建预算预测"""
    try:
        return await BudgetForecastService.create_budgetforecast(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[BudgetForecastResponse], summary="获取预算预测列表")
async def list_budgetforecasts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取预算预测列表"""
    return await BudgetForecastService.list_budgetforecasts(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=BudgetForecastResponse, summary="获取预算预测详情")
async def get_budgetforecast(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取预算预测详情"""
    try:
        return await BudgetForecastService.get_budgetforecast_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=BudgetForecastResponse, summary="更新预算预测")
async def update_budgetforecast(
    obj_uuid: str,
    data: BudgetForecastUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新预算预测"""
    try:
        return await BudgetForecastService.update_budgetforecast(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除预算预测")
async def delete_budgetforecast(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除预算预测（软删除）"""
    try:
        await BudgetForecastService.delete_budgetforecast(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
