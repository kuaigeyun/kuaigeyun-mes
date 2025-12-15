"""
实时监控服务模块

提供实时监控的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaaiot.models.real_time_monitoring import RealTimeMonitoring
from apps.kuaaiot.schemas.real_time_monitoring_schemas import (
    RealTimeMonitoringCreate, RealTimeMonitoringUpdate, RealTimeMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class RealTimeMonitoringService:
    """实时监控服务"""
    
    @staticmethod
    async def create_real_time_monitoring(
        tenant_id: int,
        data: RealTimeMonitoringCreate
    ) -> RealTimeMonitoringResponse:
        """创建实时监控"""
        existing = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            monitoring_no=data.monitoring_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"实时监控编号 {data.monitoring_no} 已存在")
        
        monitoring = await RealTimeMonitoring.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return RealTimeMonitoringResponse.model_validate(monitoring)
    
    @staticmethod
    async def get_real_time_monitoring_by_uuid(
        tenant_id: int,
        monitoring_uuid: str
    ) -> RealTimeMonitoringResponse:
        """根据UUID获取实时监控"""
        monitoring = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            uuid=monitoring_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not monitoring:
            raise NotFoundError(f"实时监控 {monitoring_uuid} 不存在")
        
        return RealTimeMonitoringResponse.model_validate(monitoring)
    
    @staticmethod
    async def list_real_time_monitorings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        monitoring_type: Optional[str] = None,
        device_id: Optional[int] = None,
        alert_status: Optional[str] = None
    ) -> List[RealTimeMonitoringResponse]:
        """获取实时监控列表"""
        query = RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if monitoring_type:
            query = query.filter(monitoring_type=monitoring_type)
        if device_id:
            query = query.filter(device_id=device_id)
        if alert_status:
            query = query.filter(alert_status=alert_status)
        
        monitorings = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [RealTimeMonitoringResponse.model_validate(m) for m in monitorings]
    
    @staticmethod
    async def update_real_time_monitoring(
        tenant_id: int,
        monitoring_uuid: str,
        data: RealTimeMonitoringUpdate
    ) -> RealTimeMonitoringResponse:
        """更新实时监控"""
        monitoring = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            uuid=monitoring_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not monitoring:
            raise NotFoundError(f"实时监控 {monitoring_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(monitoring, key, value)
        
        await monitoring.save()
        
        return RealTimeMonitoringResponse.model_validate(monitoring)
    
    @staticmethod
    async def delete_real_time_monitoring(
        tenant_id: int,
        monitoring_uuid: str
    ) -> None:
        """删除实时监控（软删除）"""
        monitoring = await RealTimeMonitoring.filter(
            tenant_id=tenant_id,
            uuid=monitoring_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not monitoring:
            raise NotFoundError(f"实时监控 {monitoring_uuid} 不存在")
        
        monitoring.deleted_at = datetime.utcnow()
        await monitoring.save()

