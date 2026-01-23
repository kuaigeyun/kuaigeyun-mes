"""
编码生成服务模块

提供根据编码规则生成编码的功能。
"""

from typing import Optional, Dict, List, Any
from datetime import datetime, date
import re
from tortoise.transactions import in_transaction

from core.models.code_rule import CodeRule
from core.models.code_sequence import CodeSequence
from core.services.business.code_rule_service import CodeRuleService
from core.services.code_rule.code_rule_component_service import CodeRuleComponentService
from infra.exceptions.exceptions import ValidationError


class CodeGenerationService:
    """
    编码生成服务类
    
    提供根据编码规则生成编码的功能。
    """
    
    @staticmethod
    async def generate_code(
        tenant_id: int,
        rule_code: str,
        context: Optional[Dict] = None
    ) -> str:
        """
        根据规则生成编码（会更新序号）
        
        Args:
            tenant_id: 组织ID
            rule_code: 规则代码
            context: 上下文变量（可选，用于自定义变量）
            
        Returns:
            str: 生成的编码
            
        Raises:
            ValidationError: 当规则不存在或未启用时抛出
        """
        # 获取编码规则
        rule = await CodeRuleService.get_rule_by_code(tenant_id, rule_code)
        if not rule:
            raise ValidationError(f"编码规则 {rule_code} 不存在或未启用")
        
        # 获取规则组件配置（优先使用新格式）
        components = rule.get_rule_components()
        counter_config = None
        if components:
            counter_config = CodeRuleComponentService.get_counter_component_config(components)
        
        # 获取序号配置（优先从组件读取，否则使用旧字段）
        if counter_config:
            seq_start = counter_config.get("initial_value", 1)
            seq_step = 1  # 组件格式中步长固定为1
            seq_reset_rule = counter_config.get("reset_cycle", "never")
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
            seq_reset_rule = rule.seq_reset_rule or "never"
        
        # 获取或创建序号记录（不使用嵌套事务，避免死锁）
        sequence = await CodeSequence.get_or_none(
            code_rule_id=rule.id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not sequence:
            sequence = await CodeSequence.create(
                code_rule_id=rule.id,
                tenant_id=tenant_id,
                current_seq=seq_start - seq_step
            )
        
        # 检查是否需要重置序号
        if seq_reset_rule and seq_reset_rule != "never":
            now = date.today()
            if sequence.reset_date != now:
                if seq_reset_rule == "daily":
                    sequence.current_seq = seq_start - seq_step
                    sequence.reset_date = now
                elif seq_reset_rule == "monthly":
                    if not sequence.reset_date or sequence.reset_date.month != now.month or sequence.reset_date.year != now.year:
                        sequence.current_seq = seq_start - seq_step
                        sequence.reset_date = now
                elif seq_reset_rule == "yearly":
                    if not sequence.reset_date or sequence.reset_date.year != now.year:
                        sequence.current_seq = seq_start - seq_step
                        sequence.reset_date = now
        
        # 递增序号（在外部事务中保存）
        sequence.current_seq += seq_step
        await sequence.save()
        
        # 生成编码
        if components:
            # 使用新格式（组件）
            return CodeRuleComponentService.render_components(
                components, sequence.current_seq, context
            )
        else:
            # 使用旧格式（表达式）
            return await CodeGenerationService._render_expression(
                rule, sequence.current_seq, context
            )
    
    @staticmethod
    async def test_generate_code(
        tenant_id: int,
        rule_code: str,
        context: Optional[Dict] = None,
        check_duplicate: bool = False,
        entity_type: Optional[str] = None
    ) -> str:
        """
        测试生成编码（不更新序号）
        
        Args:
            tenant_id: 组织ID
            rule_code: 规则代码
            context: 上下文变量（可选）
            check_duplicate: 是否检查重复（如果为True，会自动递增直到找到不重复的编码）
            entity_type: 实体类型（如：'material'，用于检查重复）
            
        Returns:
            str: 生成的编码（测试用）
        """
        # 获取编码规则
        rule = await CodeRuleService.get_rule_by_code(tenant_id, rule_code)
        if not rule:
            raise ValidationError(f"编码规则 {rule_code} 不存在或未启用")
        
        # 获取规则组件配置（优先使用新格式）
        components = rule.get_rule_components()
        counter_config = None
        if components:
            counter_config = CodeRuleComponentService.get_counter_component_config(components)
        
        # 获取序号配置（优先从组件读取，否则使用旧字段）
        if counter_config:
            seq_start = counter_config.get("initial_value", 1)
            seq_step = 1  # 组件格式中步长固定为1
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
        
        # 获取当前序号（不更新）
        sequence = await CodeSequence.get_or_none(
            code_rule_id=rule.id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 如果没有序号记录，使用起始值
        current_seq = sequence.current_seq if sequence else seq_start
        
        # 生成编码（使用当前序号 + 步长，但不保存）
        test_seq = current_seq + seq_step
        if components:
            # 使用新格式（组件）
            test_code = CodeRuleComponentService.render_components(
                components, test_seq, context
            )
        else:
            # 使用旧格式（表达式）
            test_code = await CodeGenerationService._render_expression(
                rule, test_seq, context
            )
        
        # 如果需要检查重复，自动递增直到找到不重复的编码
        if check_duplicate and entity_type:
            max_attempts = 100  # 最多尝试100次
            attempt = 0
            
            while attempt < max_attempts:
                # 检查编码是否已存在
                is_duplicate = await CodeGenerationService._check_code_exists(
                    tenant_id=tenant_id,
                    code=test_code,
                    entity_type=entity_type
                )
                
                if not is_duplicate:
                    # 找到不重复的编码，返回
                    return test_code
                
                # 编码已存在，递增序号继续尝试
                test_seq += seq_step
                if components:
                    test_code = CodeRuleComponentService.render_components(
                        components, test_seq, context
                    )
                else:
                    test_code = await CodeGenerationService._render_expression(
                        rule, test_seq, context
                    )
                attempt += 1
            
            # 如果尝试100次仍然重复，返回最后一次生成的编码（虽然理论上不应该发生）
            return test_code
        
        return test_code
    
    @staticmethod
    async def _check_code_exists(
        tenant_id: int,
        code: str,
        entity_type: str
    ) -> bool:
        """
        检查编码是否已存在
        
        Args:
            tenant_id: 组织ID
            code: 编码
            entity_type: 实体类型（如：'material'）
            
        Returns:
            bool: 如果编码已存在返回True，否则返回False
        """
        if entity_type == 'material':
            from apps.master_data.models.material import Material
            existing = await Material.filter(
                tenant_id=tenant_id,
                main_code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None
        
        # 其他实体类型的检查可以在这里扩展
        return False
    
    @staticmethod
    async def _render_expression(
        rule: CodeRule,
        current_seq: int,
        context: Optional[Dict] = None
    ) -> str:
        """
        渲染编码表达式
        
        Args:
            rule: 编码规则
            current_seq: 当前序号
            context: 上下文变量（可选）
            
        Returns:
            str: 生成的编码
        """
        code = rule.expression
        now = datetime.now()
        
        # 替换日期变量
        code = code.replace("{YYYY}", now.strftime("%Y"))
        code = code.replace("{YY}", now.strftime("%y"))
        code = code.replace("{MM}", now.strftime("%m"))
        code = code.replace("{DD}", now.strftime("%d"))
        
        # 替换序号变量
        seq_pattern = r'\{SEQ(?::(\d+))?\}'
        def replace_seq(match):
            width = int(match.group(1)) if match.group(1) else 0
            seq_str = str(current_seq)
            if width > 0:
                seq_str = seq_str.zfill(width)
            return seq_str
        
        code = re.sub(seq_pattern, replace_seq, code)
        
        # 替换字典变量（需要数据字典支持，暂时返回空）
        dict_pattern = r'\{DICT:([^}]+)\}'
        def replace_dict(match):
            dict_code = match.group(1)
            # TODO: 从数据字典获取值
            # dict_value = await DataDictionaryService.get_dict_value(tenant_id, dict_code)
            # return dict_value or ""
            return f"[DICT:{dict_code}]"  # 临时占位符
        
        code = re.sub(dict_pattern, replace_dict, code)
        
        # 替换字段引用变量 {FIELD:field_name}
        # 例如：{FIELD:group_code} 表示引用物料分组编码
        field_pattern = r'\{FIELD:([^}]+)\}'
        def replace_field(match):
            field_name = match.group(1)
            if context and field_name in context:
                return str(context[field_name])
            # 如果字段不存在，返回空字符串或占位符
            return f"[FIELD:{field_name}]"  # 字段不存在时的占位符
        
        code = re.sub(field_pattern, replace_field, code)
        
        # 替换上下文变量（兼容旧格式，直接使用变量名）
        # 例如：{group_code} 等同于 {FIELD:group_code}
        if context:
            for key, value in context.items():
                # 避免重复替换已经被 FIELD: 格式替换的变量
                if f"{{FIELD:{key}}}" not in rule.expression:
                    code = code.replace(f"{{{key}}}", str(value))
        
        return code

