"""
需求预测 API 模块

提供需求预测的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiscm.services.demand_forecast_service import DemandForecastService
from apps.kuaiscm.schemas.demand_forecast_schemas import (
    DemandForecastCreate, DemandForecastUpdate, DemandForecastResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/demand-forecasts", tags=["DemandForecasts"])


@router.post("", response_model=DemandForecastResponse, status_code=status.HTTP_201_CREATED, summary="创建需求预测")
async def create_demand_forecast(
    data: DemandForecastCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建需求预测"""
    try:
        return await DemandForecastService.create_demand_forecast(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DemandForecastResponse], summary="获取需求预测列表")
async def list_demand_forecasts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取需求预测列表"""
    return await DemandForecastService.list_demand_forecasts(tenant_id, skip, limit, supplier_id, status)


@router.get("/{forecast_uuid}", response_model=DemandForecastResponse, summary="获取需求预测详情")
async def get_demand_forecast(
    forecast_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取需求预测详情"""
    try:
        return await DemandForecastService.get_demand_forecast_by_uuid(tenant_id, forecast_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{forecast_uuid}", response_model=DemandForecastResponse, summary="更新需求预测")
async def update_demand_forecast(
    forecast_uuid: str,
    data: DemandForecastUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新需求预测"""
    try:
        return await DemandForecastService.update_demand_forecast(tenant_id, forecast_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{forecast_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除需求预测")
async def delete_demand_forecast(
    forecast_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除需求预测"""
    try:
        await DemandForecastService.delete_demand_forecast(tenant_id, forecast_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

