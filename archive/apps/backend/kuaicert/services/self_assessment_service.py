"""
自评打分服务模块

提供自评打分的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.self_assessment import SelfAssessment
from apps.kuaicert.schemas.self_assessment_schemas import (
    SelfAssessmentCreate, SelfAssessmentUpdate, SelfAssessmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SelfAssessmentService:
    """自评打分服务"""
    
    @staticmethod
    async def create_selfassessment(
        tenant_id: int,
        data: SelfAssessmentCreate
    ) -> SelfAssessmentResponse:
        """
        创建自评打分
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            SelfAssessmentResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await SelfAssessment.filter(
            tenant_id=tenant_id,
            assessment_no=data.assessment_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"自评编号 {data.assessment_no} 已存在")
        
        # 创建对象
        obj = await SelfAssessment.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SelfAssessmentResponse.model_validate(obj)
    
    @staticmethod
    async def get_selfassessment_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> SelfAssessmentResponse:
        """
        根据UUID获取自评打分
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            SelfAssessmentResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SelfAssessment.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"自评打分 {obj_uuid} 不存在")
        
        return SelfAssessmentResponse.model_validate(obj)
    
    @staticmethod
    async def list_selfassessments(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[SelfAssessmentResponse]:
        """
        获取自评打分列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[SelfAssessmentResponse]: 对象列表
        """
        query = SelfAssessment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [SelfAssessmentResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_selfassessment(
        tenant_id: int,
        obj_uuid: str,
        data: SelfAssessmentUpdate
    ) -> SelfAssessmentResponse:
        """
        更新自评打分
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            SelfAssessmentResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SelfAssessment.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"自评打分 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return SelfAssessmentResponse.model_validate(obj)
    
    @staticmethod
    async def delete_selfassessment(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除自评打分（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await SelfAssessment.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"自评打分 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
