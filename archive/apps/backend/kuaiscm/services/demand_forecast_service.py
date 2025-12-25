"""
需求预测服务模块

提供需求预测的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiscm.models.demand_forecast import DemandForecast
from apps.kuaiscm.schemas.demand_forecast_schemas import (
    DemandForecastCreate, DemandForecastUpdate, DemandForecastResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DemandForecastService:
    """需求预测服务"""
    
    @staticmethod
    async def create_demand_forecast(
        tenant_id: int,
        data: DemandForecastCreate
    ) -> DemandForecastResponse:
        """创建需求预测"""
        existing = await DemandForecast.filter(
            tenant_id=tenant_id,
            forecast_no=data.forecast_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"需求预测编号 {data.forecast_no} 已存在")
        
        forecast = await DemandForecast.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DemandForecastResponse.model_validate(forecast)
    
    @staticmethod
    async def get_demand_forecast_by_uuid(
        tenant_id: int,
        forecast_uuid: str
    ) -> DemandForecastResponse:
        """根据UUID获取需求预测"""
        forecast = await DemandForecast.filter(
            tenant_id=tenant_id,
            uuid=forecast_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not forecast:
            raise NotFoundError(f"需求预测 {forecast_uuid} 不存在")
        
        return DemandForecastResponse.model_validate(forecast)
    
    @staticmethod
    async def list_demand_forecasts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[DemandForecastResponse]:
        """获取需求预测列表"""
        query = DemandForecast.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        if status:
            query = query.filter(status=status)
        
        forecasts = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [DemandForecastResponse.model_validate(f) for f in forecasts]
    
    @staticmethod
    async def update_demand_forecast(
        tenant_id: int,
        forecast_uuid: str,
        data: DemandForecastUpdate
    ) -> DemandForecastResponse:
        """更新需求预测"""
        forecast = await DemandForecast.filter(
            tenant_id=tenant_id,
            uuid=forecast_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not forecast:
            raise NotFoundError(f"需求预测 {forecast_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(forecast, key, value)
        
        await forecast.save()
        
        return DemandForecastResponse.model_validate(forecast)
    
    @staticmethod
    async def delete_demand_forecast(
        tenant_id: int,
        forecast_uuid: str
    ) -> None:
        """删除需求预测（软删除）"""
        forecast = await DemandForecast.filter(
            tenant_id=tenant_id,
            uuid=forecast_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not forecast:
            raise NotFoundError(f"需求预测 {forecast_uuid} 不存在")
        
        forecast.deleted_at = datetime.utcnow()
        await forecast.save()

