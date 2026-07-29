"""
编码规则服务模块

提供编码规则的 CRUD 操作。
"""

from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from core.config.code_rule_pages import get_canonical_rule_code
from core.models.code_rule import CodeRule
from core.schemas.code_rule import CodeRuleCreate, CodeRuleUpdate
from core.utils.timezone_utils import now_utc
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
            
            rule_components = rule_data.get("rule_components")
            if not rule_components:
                raise ValidationError("规则组件(rule_components)为必填项")
            expression = CodeRuleComponentService.components_to_expression(rule_components)
            rule_data["expression"] = expression
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
        code: str,
        *,
        active_only: bool = True,
    ) -> Optional[CodeRule]:
        """
        根据代码获取规则
        
        Args:
            tenant_id: 组织ID
            code: 规则代码
            active_only: 为 True 时仅返回启用中的规则（生成编码等默认场景）；恢复预设等场景传 False
            
        Returns:
            CodeRule: 规则对象，如果不存在返回 None
        """
        q = CodeRule.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
        )
        if active_only:
            q = q.filter(is_active=True)
        # 同 code 多条时取最近更新，与 resolve_rule_for_page / 编码规则页保存一致
        return await q.order_by("-updated_at", "-id").first()

    @staticmethod
    async def resolve_rule_for_page(
        tenant_id: int,
        page_code: str,
        *,
        active_only: bool = True,
    ) -> Optional[CodeRule]:
        """按 manifest 声明的 rule_code 精确加载租户编码规则（唯一真源）。"""
        rule_code = get_canonical_rule_code(page_code)
        if not rule_code:
            return None
        return await CodeRuleService.get_rule_by_code(
            tenant_id, rule_code, active_only=active_only
        )

    @staticmethod
    async def resolve_rule_by_code(
        tenant_id: int,
        rule_code: str,
        *,
        active_only: bool = True,
    ) -> Tuple[Optional[CodeRule], str]:
        """按 manifest rule_code 精确加载规则，不做 alias / 派生码回退。"""
        rule = await CodeRuleService.get_rule_by_code(
            tenant_id, rule_code, active_only=active_only
        )
        if rule:
            return rule, rule.code
        return None, rule_code

    @staticmethod
    async def map_rules_by_codes(tenant_id: int, codes: List[str]) -> Dict[str, CodeRule]:
        """按规则代码批量加载（含未启用），用于批量恢复预设等。"""
        uniq = list(dict.fromkeys(c for c in codes if c))
        if not uniq:
            return {}
        rows = await CodeRule.filter(
            tenant_id=tenant_id,
            code__in=uniq,
            deleted_at__isnull=True,
        ).all()
        return {r.code: r for r in rows}
    
    @staticmethod
    async def list_rules(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        disallowed_rule_codes: Optional[Set[str]] = None,
    ) -> List[CodeRule]:
        """
        获取规则列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            disallowed_rule_codes: 因应用未启用而不可见的规则代码（与 code_rule_pages 对齐）
            
        Returns:
            List[CodeRule]: 规则列表
        """
        query = CodeRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if disallowed_rule_codes:
            query = query.filter(~Q(code__in=list(disallowed_rule_codes)))
        
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
        
        rule_components = update_data.get("rule_components")
        if rule_components is not None:
            if rule_components is None or (isinstance(rule_components, list) and len(rule_components) == 0):
                update_data.pop("rule_components", None)
            else:
                expression = CodeRuleComponentService.components_to_expression(rule_components)
                if not expression:
                    raise ValidationError("规则组件无法生成有效的表达式")
                update_data["expression"] = expression
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
        rule.deleted_at = now_utc()
        await rule.save()

    @staticmethod
    async def bulk_enable_all(tenant_id: int) -> int:
        """
        批量启用当前组织的所有编码规则

        Args:
            tenant_id: 组织ID

        Returns:
            int: 被启用的规则数量
        """
        return await CodeRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=False,
        ).update(is_active=True, updated_at=now_utc())

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

