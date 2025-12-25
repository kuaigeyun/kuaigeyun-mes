"""
KPI服务模块

提供KPI的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiepm.models.kpi import KPI
from apps.kuaiepm.schemas.kpi_schemas import (
    KPICreate, KPIUpdate, KPIResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class KPIService:
    """KPI服务"""
    
    @staticmethod
    async def create_kpi(
        tenant_id: int,
        data: KPICreate
    ) -> KPIResponse:
        """
        创建KPI
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            KPIResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await KPI.filter(
            tenant_id=tenant_id,
            kpi_code=data.kpi_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"KPI编码 {data.kpi_code} 已存在")
        
        # 创建对象
        obj = await KPI.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return KPIResponse.model_validate(obj)
    
    @staticmethod
    async def get_kpi_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> KPIResponse:
        """
        根据UUID获取KPI
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            KPIResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPI.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI {obj_uuid} 不存在")
        
        return KPIResponse.model_validate(obj)
    
    @staticmethod
    async def list_kpis(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[KPIResponse]:
        """
        获取KPI列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[KPIResponse]: 对象列表
        """
        query = KPI.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [KPIResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_kpi(
        tenant_id: int,
        obj_uuid: str,
        data: KPIUpdate
    ) -> KPIResponse:
        """
        更新KPI
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            KPIResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPI.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return KPIResponse.model_validate(obj)
    
    @staticmethod
    async def delete_kpi(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除KPI（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await KPI.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"KPI {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
