"""
能源监测服务模块

提供能源监测的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiems.models.energy_monitoring import EnergyMonitoring
from apps.kuaiems.schemas.energy_monitoring_schemas import (
    EnergyMonitoringCreate, EnergyMonitoringUpdate, EnergyMonitoringResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EnergyMonitoringService:
    """能源监测服务"""
    
    @staticmethod
    async def create_energy_monitoring(
        tenant_id: int,
        data: EnergyMonitoringCreate
    ) -> EnergyMonitoringResponse:
        """创建能源监测"""
        existing = await EnergyMonitoring.filter(
            tenant_id=tenant_id,
            monitoring_no=data.monitoring_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"能源监测编号 {data.monitoring_no} 已存在")
        
        monitoring = await EnergyMonitoring.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return EnergyMonitoringResponse.model_validate(monitoring)
    
    @staticmethod
    async def get_energy_monitoring_by_uuid(
        tenant_id: int,
        monitoring_uuid: str
    ) -> EnergyMonitoringResponse:
        """根据UUID获取能源监测"""
        monitoring = await EnergyMonitoring.filter(
            tenant_id=tenant_id,
            uuid=monitoring_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not monitoring:
            raise NotFoundError(f"能源监测 {monitoring_uuid} 不存在")
        
        return EnergyMonitoringResponse.model_validate(monitoring)
    
    @staticmethod
    async def list_energy_monitorings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        energy_type: Optional[str] = None,
        collection_status: Optional[str] = None,
        alert_status: Optional[str] = None
    ) -> List[EnergyMonitoringResponse]:
        """获取能源监测列表"""
        query = EnergyMonitoring.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if energy_type:
            query = query.filter(energy_type=energy_type)
        if collection_status:
            query = query.filter(collection_status=collection_status)
        if alert_status:
            query = query.filter(alert_status=alert_status)
        
        monitorings = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [EnergyMonitoringResponse.model_validate(m) for m in monitorings]
    
    @staticmethod
    async def update_energy_monitoring(
        tenant_id: int,
        monitoring_uuid: str,
        data: EnergyMonitoringUpdate
    ) -> EnergyMonitoringResponse:
        """更新能源监测"""
        monitoring = await EnergyMonitoring.filter(
            tenant_id=tenant_id,
            uuid=monitoring_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not monitoring:
            raise NotFoundError(f"能源监测 {monitoring_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(monitoring, key, value)
        
        await monitoring.save()
        
        return EnergyMonitoringResponse.model_validate(monitoring)
    
    @staticmethod
    async def delete_energy_monitoring(
        tenant_id: int,
        monitoring_uuid: str
    ) -> None:
        """删除能源监测（软删除）"""
        monitoring = await EnergyMonitoring.filter(
            tenant_id=tenant_id,
            uuid=monitoring_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not monitoring:
            raise NotFoundError(f"能源监测 {monitoring_uuid} 不存在")
        
        monitoring.deleted_at = datetime.utcnow()
        await monitoring.save()

