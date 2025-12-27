"""
缺料预警服务模块

提供缺料预警的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaimrp.models.shortage_alert import ShortageAlert
from apps.kuaimrp.schemas.shortage_alert_schemas import (
    ShortageAlertCreate, ShortageAlertUpdate, ShortageAlertResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ShortageAlertService:
    """缺料预警服务"""
    
    @staticmethod
    async def create_shortage_alert(
        tenant_id: int,
        data: ShortageAlertCreate
    ) -> ShortageAlertResponse:
        """
        创建缺料预警
        
        Args:
            tenant_id: 租户ID
            data: 预警创建数据
            
        Returns:
            ShortageAlertResponse: 创建的预警对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ShortageAlert.filter(
            tenant_id=tenant_id,
            alert_no=data.alert_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"预警编号 {data.alert_no} 已存在")
        
        # 创建预警
        alert = await ShortageAlert.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ShortageAlertResponse.model_validate(alert)
    
    @staticmethod
    async def get_shortage_alert_by_uuid(
        tenant_id: int,
        alert_uuid: str
    ) -> ShortageAlertResponse:
        """
        根据UUID获取缺料预警
        
        Args:
            tenant_id: 租户ID
            alert_uuid: 预警UUID
            
        Returns:
            ShortageAlertResponse: 预警对象
            
        Raises:
            NotFoundError: 当预警不存在时抛出
        """
        alert = await ShortageAlert.filter(
            tenant_id=tenant_id,
            uuid=alert_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not alert:
            raise NotFoundError(f"缺料预警 {alert_uuid} 不存在")
        
        return ShortageAlertResponse.model_validate(alert)
    
    @staticmethod
    async def list_shortage_alerts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        alert_level: Optional[str] = None,
        alert_status: Optional[str] = None,
        material_id: Optional[int] = None
    ) -> List[ShortageAlertResponse]:
        """
        获取缺料预警列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            alert_level: 预警等级（过滤）
            alert_status: 预警状态（过滤）
            material_id: 物料ID（过滤）
            
        Returns:
            List[ShortageAlertResponse]: 预警列表
        """
        query = ShortageAlert.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if alert_level:
            query = query.filter(alert_level=alert_level)
        if alert_status:
            query = query.filter(alert_status=alert_status)
        if material_id:
            query = query.filter(material_id=material_id)
        
        alerts = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ShortageAlertResponse.model_validate(alert) for alert in alerts]
    
    @staticmethod
    async def update_shortage_alert(
        tenant_id: int,
        alert_uuid: str,
        data: ShortageAlertUpdate
    ) -> ShortageAlertResponse:
        """
        更新缺料预警
        
        Args:
            tenant_id: 租户ID
            alert_uuid: 预警UUID
            data: 预警更新数据
            
        Returns:
            ShortageAlertResponse: 更新后的预警对象
            
        Raises:
            NotFoundError: 当预警不存在时抛出
        """
        alert = await ShortageAlert.filter(
            tenant_id=tenant_id,
            uuid=alert_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not alert:
            raise NotFoundError(f"缺料预警 {alert_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(alert, key, value)
        
        await alert.save()
        
        return ShortageAlertResponse.model_validate(alert)
    
    @staticmethod
    async def delete_shortage_alert(
        tenant_id: int,
        alert_uuid: str
    ) -> None:
        """
        删除缺料预警（软删除）
        
        Args:
            tenant_id: 租户ID
            alert_uuid: 预警UUID
            
        Raises:
            NotFoundError: 当预警不存在时抛出
        """
        alert = await ShortageAlert.filter(
            tenant_id=tenant_id,
            uuid=alert_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not alert:
            raise NotFoundError(f"缺料预警 {alert_uuid} 不存在")
        
        alert.deleted_at = datetime.utcnow()
        await alert.save()
    
    @staticmethod
    async def handle_shortage_alert(
        tenant_id: int,
        alert_uuid: str,
        handler_id: int,
        handle_result: str
    ) -> ShortageAlertResponse:
        """
        处理缺料预警
        
        Args:
            tenant_id: 租户ID
            alert_uuid: 预警UUID
            handler_id: 处理人ID
            handle_result: 处理结果
            
        Returns:
            ShortageAlertResponse: 更新后的预警对象
            
        Raises:
            NotFoundError: 当预警不存在时抛出
        """
        alert = await ShortageAlert.filter(
            tenant_id=tenant_id,
            uuid=alert_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not alert:
            raise NotFoundError(f"缺料预警 {alert_uuid} 不存在")
        
        alert.handler_id = handler_id
        alert.handled_at = datetime.utcnow()
        alert.handle_result = handle_result
        alert.alert_status = "已解决"
        await alert.save()
        
        return ShortageAlertResponse.model_validate(alert)
