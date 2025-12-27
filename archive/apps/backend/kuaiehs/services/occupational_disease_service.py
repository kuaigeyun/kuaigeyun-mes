"""
职业病服务模块

提供职业病的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.health import OccupationalDisease
from apps.kuaiehs.schemas.occupational_disease_schemas import (
    OccupationalDiseaseCreate, OccupationalDiseaseUpdate, OccupationalDiseaseResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class OccupationalDiseaseService:
    """职业病服务"""
    
    @staticmethod
    async def create_occupationaldisease(
        tenant_id: int,
        data: OccupationalDiseaseCreate
    ) -> OccupationalDiseaseResponse:
        """
        创建职业病
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            OccupationalDiseaseResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await OccupationalDisease.filter(
            tenant_id=tenant_id,
            disease_no=data.disease_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"病案编号 {data.disease_no} 已存在")
        
        # 创建对象
        obj = await OccupationalDisease.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OccupationalDiseaseResponse.model_validate(obj)
    
    @staticmethod
    async def get_occupationaldisease_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> OccupationalDiseaseResponse:
        """
        根据UUID获取职业病
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            OccupationalDiseaseResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await OccupationalDisease.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"职业病 {obj_uuid} 不存在")
        
        return OccupationalDiseaseResponse.model_validate(obj)
    
    @staticmethod
    async def list_occupationaldiseases(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[OccupationalDiseaseResponse]:
        """
        获取职业病列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[OccupationalDiseaseResponse]: 对象列表
        """
        query = OccupationalDisease.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [OccupationalDiseaseResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_occupationaldisease(
        tenant_id: int,
        obj_uuid: str,
        data: OccupationalDiseaseUpdate
    ) -> OccupationalDiseaseResponse:
        """
        更新职业病
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            OccupationalDiseaseResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await OccupationalDisease.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"职业病 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return OccupationalDiseaseResponse.model_validate(obj)
    
    @staticmethod
    async def delete_occupationaldisease(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除职业病（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await OccupationalDisease.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"职业病 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
