"""
编码规则服务模块

提供编码规则的 CRUD 操作。
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from tortoise.exceptions import IntegrityError

from core.models.code_rule import CodeRule
from core.schemas.code_rule import CodeRuleCreate, CodeRuleUpdate
from core.services.code_rule.code_rule_component_service import CodeRuleComponentService
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
            rule_data = data.model_dump()
            
            # 处理新旧格式转换
            rule_components = rule_data.get("rule_components")
            expression = rule_data.get("expression")
            
            # 如果提供了rule_components，自动生成expression（向后兼容）
            if rule_components:
                expression = CodeRuleComponentService.components_to_expression(rule_components)
                rule_data["expression"] = expression
                
                # 从自动计数组件读取seq_start和seq_reset_rule（向后兼容）
                counter_config = CodeRuleComponentService.get_counter_component_config(rule_components)
                if counter_config:
                    rule_data["seq_start"] = counter_config.get("initial_value", 1)
                    rule_data["seq_reset_rule"] = counter_config.get("reset_cycle", "never")
            
            # 如果只提供了expression，尝试解析为rule_components（向后兼容）
            elif expression and not rule_components:
                rule_components = CodeRuleComponentService.expression_to_components(expression)
                rule_data["rule_components"] = rule_components
                
                # 从解析的组件中提取seq_start和seq_reset_rule（向后兼容）
                counter_config = CodeRuleComponentService.get_counter_component_config(rule_components)
                if counter_config:
                    rule_data["seq_start"] = counter_config.get("initial_value", 1)
                    rule_data["seq_reset_rule"] = counter_config.get("reset_cycle", "never")
            
            rule = CodeRule(
                tenant_id=tenant_id,
                **rule_data
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
        
        # 处理新旧格式转换
        rule_components = update_data.get("rule_components")
        expression = update_data.get("expression")
        
        # 如果更新了rule_components，自动生成expression（向后兼容）
        if rule_components is not None:
            # 验证器已经将空列表转换为None，所以这里rule_components不会是空列表
            # 如果rule_components是None（由验证器转换），跳过处理
            if rule_components is None:
                # 空列表被验证器转换为None，表示不更新rule_components
                update_data.pop("rule_components", None)
            else:
                # 验证rule_components是否有效
                if isinstance(rule_components, list):
                    # 允许没有自动计数组件的规则（如BOM使用物料号+版本号区分）
                    pass
                
                expression = CodeRuleComponentService.components_to_expression(rule_components)
                # 如果生成的表达式为空，抛出错误
                if not expression:
                    raise ValidationError("规则组件无法生成有效的表达式")
                
                update_data["expression"] = expression
                
                # 从自动计数组件读取seq_start和seq_reset_rule（向后兼容）
                counter_config = CodeRuleComponentService.get_counter_component_config(rule_components)
                if counter_config:
                    update_data["seq_start"] = counter_config.get("initial_value", 1)
                    update_data["seq_reset_rule"] = counter_config.get("reset_cycle", "never")
        
        # 如果只更新了expression，尝试解析为rule_components（向后兼容）
        elif expression is not None and rule_components is None:
            rule_components = CodeRuleComponentService.expression_to_components(expression)
            update_data["rule_components"] = rule_components
            
            # 从解析的组件中提取seq_start和seq_reset_rule（向后兼容）
            counter_config = CodeRuleComponentService.get_counter_component_config(rule_components)
            if counter_config:
                update_data["seq_start"] = counter_config.get("initial_value", 1)
                update_data["seq_reset_rule"] = counter_config.get("reset_cycle", "never")
        
        # 如果更新了表达式，需要验证
        if 'expression' in update_data:
            original_expression = rule.expression
            new_expression = update_data['expression']
            # 如果表达式为空字符串，且没有rule_components，则使用原有表达式
            if not new_expression and not update_data.get("rule_components"):
                # 保留原有表达式，不更新
                update_data.pop('expression')
            else:
                rule.expression = new_expression
                if not rule.validate_expression():
                    rule.expression = original_expression
                    raise ValidationError("编码规则表达式无效")
        
        # 记录变更前的规则代码和状态（用于通知业务模块）
        old_code = rule.code
        old_is_active = rule.is_active
        
        # 更新其他字段
        for key, value in update_data.items():
            setattr(rule, key, value)
        
        await rule.save()
        
        # 如果规则代码或状态变更，通知业务模块（异步，不阻塞主流程）
        code_changed = old_code != rule.code
        status_changed = old_is_active != rule.is_active
        
        if code_changed or status_changed or 'expression' in update_data:
            import asyncio
            # 异步通知业务模块编码规则变更
            asyncio.create_task(
                CodeRuleService._notify_business_modules(
                    tenant_id=tenant_id,
                    rule_code=old_code if code_changed else rule.code,
                    new_rule_code=rule.code if code_changed else None,
                    is_active=rule.is_active,
                    expression_changed='expression' in update_data
                )
            )
        
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
        
        # 通知业务模块编码规则将被删除（异步，不阻塞主流程）
        import asyncio
        asyncio.create_task(
            CodeRuleService._notify_business_modules(
                tenant_id=tenant_id,
                rule_code=rule.code,
                is_active=False,
                is_deleted=True
            )
        )
        
        # 软删除
        from datetime import datetime
        rule.deleted_at = datetime.now()
        await rule.save()
    
    @staticmethod
    async def _notify_business_modules(
        tenant_id: int,
        rule_code: str,
        new_rule_code: Optional[str] = None,
        is_active: bool = True,
        expression_changed: bool = False,
        is_deleted: bool = False
    ) -> None:
        """
        通知业务模块编码规则变更
        
        这是一个预留方法，用于将来实现业务模块的编码规则变更通知。
        目前只是记录变更，不执行具体操作。
        
        Args:
            tenant_id: 组织ID
            rule_code: 规则代码
            new_rule_code: 新规则代码（如果规则代码变更）
            is_active: 是否启用
            expression_changed: 表达式是否变更
            is_deleted: 是否删除
        """
        # TODO: 如果将来需要业务模块自动更新编码，可以在这里实现
        # 例如：
        # 1. 查找所有使用该编码规则的业务记录
        # 2. 根据新的编码规则重新生成编码
        # 3. 更新业务记录的编码字段
        
        # 注意：编码规则变更通常不应该自动更新已生成的编码
        # 因为已生成的编码可能已经被使用，更改会导致数据不一致
        # 只有在特殊情况下（如编码规则错误修复）才需要重新生成编码
        pass

