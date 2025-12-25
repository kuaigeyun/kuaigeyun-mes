"""
职业健康检查服务模块

提供职业健康检查的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.health import OccupationalHealthCheck
from apps.kuaiehs.schemas.occupational_health_check_schemas import (
    OccupationalHealthCheckCreate, OccupationalHealthCheckUpdate, OccupationalHealthCheckResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OccupationalHealthCheckService:
    """职业健康检查服务"""
    
    @staticmethod
    async def create_occupationalhealthcheck(
        tenant_id: int,
        data: OccupationalHealthCheckCreate
    ) -> OccupationalHealthCheckResponse:
        """
        创建职业健康检查
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            OccupationalHealthCheckResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await OccupationalHealthCheck.filter(
            tenant_id=tenant_id,
            check_no=data.check_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"检查编号 {data.check_no} 已存在")
        
        # 创建对象
        obj = await OccupationalHealthCheck.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OccupationalHealthCheckResponse.model_validate(obj)
    
    @staticmethod
    async def get_occupationalhealthcheck_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> OccupationalHealthCheckResponse:
        """
        根据UUID获取职业健康检查
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            OccupationalHealthCheckResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await OccupationalHealthCheck.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"职业健康检查 {obj_uuid} 不存在")
        
        return OccupationalHealthCheckResponse.model_validate(obj)
    
    @staticmethod
    async def list_occupationalhealthchecks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[OccupationalHealthCheckResponse]:
        """
        获取职业健康检查列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[OccupationalHealthCheckResponse]: 对象列表
        """
        query = OccupationalHealthCheck.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [OccupationalHealthCheckResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_occupationalhealthcheck(
        tenant_id: int,
        obj_uuid: str,
        data: OccupationalHealthCheckUpdate
    ) -> OccupationalHealthCheckResponse:
        """
        更新职业健康检查
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            OccupationalHealthCheckResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await OccupationalHealthCheck.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"职业健康检查 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return OccupationalHealthCheckResponse.model_validate(obj)
    
    @staticmethod
    async def delete_occupationalhealthcheck(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除职业健康检查（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await OccupationalHealthCheck.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"职业健康检查 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
