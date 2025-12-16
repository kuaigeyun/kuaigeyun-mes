"""
KPI预警服务模块

提供KPI预警的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.kpi import KPIAlert
from apps.kuaiepm.schemas.kpi_alert_schemas import (
    KPIAlertCreate, KPIAlertUpdate, KPIAlertResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class KPIAlertService:
    """KPI预警服务"""
    
    @staticmethod
    async def create_kpialert(
        tenant_id: int,
        data: KPIAlertCreate
    ) -> KPIAlertResponse:
        """
        创建KPI预警
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            KPIAlertResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await KPIAlert.filter(
            tenant_id=tenant_id,
            alert_no=data.alert_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"预警编号 {data.alert_no} 已存在")
        
        # 创建对象
        obj = await KPIAlert.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return KPIAlertResponse.model_validate(obj)
    
    @staticmethod
    async def get_kpialert_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> KPIAlertResponse:
        """
        根据UUID获取KPI预警
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            KPIAlertResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIAlert.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI预警 {obj_uuid} 不存在")
        
        return KPIAlertResponse.model_validate(obj)
    
    @staticmethod
    async def list_kpialerts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[KPIAlertResponse]:
        """
        获取KPI预警列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[KPIAlertResponse]: 对象列表
        """
        query = KPIAlert.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [KPIAlertResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_kpialert(
        tenant_id: int,
        obj_uuid: str,
        data: KPIAlertUpdate
    ) -> KPIAlertResponse:
        """
        更新KPI预警
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            KPIAlertResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIAlert.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI预警 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return KPIAlertResponse.model_validate(obj)
    
    @staticmethod
    async def delete_kpialert(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除KPI预警（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPIAlert.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI预警 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
