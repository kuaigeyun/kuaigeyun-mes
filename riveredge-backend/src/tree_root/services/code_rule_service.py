"""
编码规则服务模块

提供编码规则的 CRUD 操作。
"""

from typing import List, Optional
from uuid import UUID
from tortoise.exceptions import IntegrityError

from tree_root.models.code_rule import CodeRule
from tree_root.schemas.code_rule import CodeRuleCreate, CodeRuleUpdate
from soil.exceptions.exceptions import NotFoundError, ValidationError


class CodeRuleService:
    """
    编码规则服务类
    
    提供编码规则的 CRUD 操作。
    """
    
    @staticmethod
    async def create_rule(
        tenant_id: int,
        data: CodeRuleCreate
    ) -> CodeRule:
        """
        创建编码规则
        
        Args:
            tenant_id: 组织ID
            data: 规则创建数据
            
        Returns:
            CodeRule: 创建的规则对象
            
        Raises:
            ValidationError: 当规则代码已存在或表达式无效时抛出
        """
        try:
            rule = CodeRule(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            
            # 验证表达式
            if not rule.validate_expression():
                raise ValidationError("编码规则表达式无效")
            
            await rule.save()
            return rule
        except IntegrityError:
            raise ValidationError(f"规则代码 {data.code} 已存在")
    
    @staticmethod
    async def get_rule_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> CodeRule:
        """
        根据UUID获取规则
        
        Args:
            tenant_id: 组织ID
            uuid: 规则UUID
            
        Returns:
            CodeRule: 规则对象
            
        Raises:
            NotFoundError: 当规则不存在时抛出
        """
        rule = await CodeRule.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rule:
            raise NotFoundError("编码规则不存在")
        
        return rule
    
    @staticmethod
    async def get_rule_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[CodeRule]:
        """
        根据代码获取规则
        
        Args:
            tenant_id: 组织ID
            code: 规则代码
            
        Returns:
            CodeRule: 规则对象，如果不存在返回 None
        """
        return await CodeRule.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
            is_active=True
        ).first()
    
    @staticmethod
    async def list_rules(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[CodeRule]:
        """
        获取规则列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[CodeRule]: 规则列表
        """
        query = CodeRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.offset(skip).limit(limit).order_by("-created_at")
    
    @staticmethod
    async def update_rule(
        tenant_id: int,
        uuid: str,
        data: CodeRuleUpdate
    ) -> CodeRule:
        """
        更新规则
        
        Args:
            tenant_id: 组织ID
            uuid: 规则UUID
            data: 规则更新数据
            
        Returns:
            CodeRule: 更新后的规则对象
            
        Raises:
            NotFoundError: 当规则不存在时抛出
            ValidationError: 当表达式无效时抛出
        """
        rule = await CodeRuleService.get_rule_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果更新了表达式，需要验证
        if 'expression' in update_data:
            original_expression = rule.expression
            rule.expression = update_data['expression']
            if not rule.validate_expression():
                rule.expression = original_expression
                raise ValidationError("编码规则表达式无效")
        
        # 更新其他字段
        for key, value in update_data.items():
            setattr(rule, key, value)
        
        await rule.save()
        return rule
    
    @staticmethod
    async def delete_rule(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除规则（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 规则UUID
            
        Raises:
            NotFoundError: 当规则不存在时抛出
            ValidationError: 当规则是系统规则时抛出
        """
        rule = await CodeRuleService.get_rule_by_uuid(tenant_id, uuid)
        
        if rule.is_system:
            raise ValidationError("系统规则不可删除")
        
        # 软删除
        from datetime import datetime
        rule.deleted_at = datetime.now()
        await rule.save()

