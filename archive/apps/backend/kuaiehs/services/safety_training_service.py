"""
安全培训服务模块

提供安全培训的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.safety import SafetyTraining
from apps.kuaiehs.schemas.safety_training_schemas import (
    SafetyTrainingCreate, SafetyTrainingUpdate, SafetyTrainingResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SafetyTrainingService:
    """安全培训服务"""
    
    @staticmethod
    async def create_safetytraining(
        tenant_id: int,
        data: SafetyTrainingCreate
    ) -> SafetyTrainingResponse:
        """
        创建安全培训
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SafetyTrainingResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SafetyTraining.filter(
            tenant_id=tenant_id,
            training_no=data.training_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"培训编号 {data.training_no} 已存在")
        
        # 创建对象
        obj = await SafetyTraining.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SafetyTrainingResponse.model_validate(obj)
    
    @staticmethod
    async def get_safetytraining_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SafetyTrainingResponse:
        """
        根据UUID获取安全培训
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SafetyTrainingResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyTraining.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全培训 {obj_uuid} 不存在")
        
        return SafetyTrainingResponse.model_validate(obj)
    
    @staticmethod
    async def list_safetytrainings(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SafetyTrainingResponse]:
        """
        获取安全培训列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[SafetyTrainingResponse]: 对象列表
        """
        query = SafetyTraining.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [SafetyTrainingResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_safetytraining(
        tenant_id: int,
        obj_uuid: str,
        data: SafetyTrainingUpdate
    ) -> SafetyTrainingResponse:
        """
        更新安全培训
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SafetyTrainingResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyTraining.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全培训 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return SafetyTrainingResponse.model_validate(obj)
    
    @staticmethod
    async def delete_safetytraining(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除安全培训（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SafetyTraining.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"安全培训 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
