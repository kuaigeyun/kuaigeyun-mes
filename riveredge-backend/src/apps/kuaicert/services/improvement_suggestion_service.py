"""
改进建议服务模块

提供改进建议的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.improvement import ImprovementSuggestion
from apps.kuaicert.schemas.improvement_suggestion_schemas import (
    ImprovementSuggestionCreate, ImprovementSuggestionUpdate, ImprovementSuggestionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ImprovementSuggestionService:
    """改进建议服务"""
    
    @staticmethod
    async def create_improvementsuggestion(
        tenant_id: int,
        data: ImprovementSuggestionCreate
    ) -> ImprovementSuggestionResponse:
        """
        创建改进建议
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ImprovementSuggestionResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ImprovementSuggestion.filter(
            tenant_id=tenant_id,
            suggestion_no=data.suggestion_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"建议编号 {data.suggestion_no} 已存在")
        
        # 创建对象
        obj = await ImprovementSuggestion.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ImprovementSuggestionResponse.model_validate(obj)
    
    @staticmethod
    async def get_improvementsuggestion_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ImprovementSuggestionResponse:
        """
        根据UUID获取改进建议
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ImprovementSuggestionResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ImprovementSuggestion.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"改进建议 {obj_uuid} 不存在")
        
        return ImprovementSuggestionResponse.model_validate(obj)
    
    @staticmethod
    async def list_improvementsuggestions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ImprovementSuggestionResponse]:
        """
        获取改进建议列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ImprovementSuggestionResponse]: 对象列表
        """
        query = ImprovementSuggestion.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ImprovementSuggestionResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_improvementsuggestion(
        tenant_id: int,
        obj_uuid: str,
        data: ImprovementSuggestionUpdate
    ) -> ImprovementSuggestionResponse:
        """
        更新改进建议
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ImprovementSuggestionResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ImprovementSuggestion.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"改进建议 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ImprovementSuggestionResponse.model_validate(obj)
    
    @staticmethod
    async def delete_improvementsuggestion(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除改进建议（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ImprovementSuggestion.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"改进建议 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
