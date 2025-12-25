"""
评分规则服务模块

提供评分规则的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.scoring_rule import ScoringRule
from apps.kuaicert.schemas.scoring_rule_schemas import (
    ScoringRuleCreate, ScoringRuleUpdate, ScoringRuleResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ScoringRuleService:
    """评分规则服务"""
    
    @staticmethod
    async def create_scoringrule(
        tenant_id: int,
        data: ScoringRuleCreate
    ) -> ScoringRuleResponse:
        """
        创建评分规则
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ScoringRuleResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ScoringRule.filter(
            tenant_id=tenant_id,
            rule_no=data.rule_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"规则编号 {data.rule_no} 已存在")
        
        # 创建对象
        obj = await ScoringRule.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ScoringRuleResponse.model_validate(obj)
    
    @staticmethod
    async def get_scoringrule_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ScoringRuleResponse:
        """
        根据UUID获取评分规则
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ScoringRuleResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ScoringRule.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"评分规则 {obj_uuid} 不存在")
        
        return ScoringRuleResponse.model_validate(obj)
    
    @staticmethod
    async def list_scoringrules(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ScoringRuleResponse]:
        """
        获取评分规则列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ScoringRuleResponse]: 对象列表
        """
        query = ScoringRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ScoringRuleResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_scoringrule(
        tenant_id: int,
        obj_uuid: str,
        data: ScoringRuleUpdate
    ) -> ScoringRuleResponse:
        """
        更新评分规则
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ScoringRuleResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ScoringRule.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"评分规则 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ScoringRuleResponse.model_validate(obj)
    
    @staticmethod
    async def delete_scoringrule(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除评分规则（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ScoringRule.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"评分规则 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
