"""
编码生成服务模块

提供根据编码规则生成编码的功能。
支持导入数据后序列号校准：从库中取最大已用序号，使新生成的序号接着往后。
"""

from typing import Optional, Dict, List, Any
from datetime import datetime, date
import re
import importlib

from loguru import logger

from core.models.code_rule import CodeRule
from core.models.code_sequence import CodeSequence
from core.services.business.code_rule_service import CodeRuleService
from core.services.code_rule.code_rule_component_service import CodeRuleComponentService
from core.config.code_rule_pages import RULE_CODE_ENTITY_FOR_SEQ_SYNC
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
        
        # 如果没有自动计数组件，直接生成编码（不递增序号）
        if not counter_config and components:
            # 使用新格式（组件），序号传0（不会被使用）
            return CodeRuleComponentService.render_components(
                components, 0, context
            )
        
        # 获取序号配置（优先从组件读取，否则使用旧字段）
        scope_key = ""
        if counter_config:
            seq_start = counter_config.get("initial_value", 1)
            seq_step = 1  # 组件格式中步长固定为1
            seq_reset_rule = counter_config.get("reset_cycle", "never")
            
            # 计算 Scope Key
            scope_fields = counter_config.get("scope_fields", [])
            if scope_fields and context:
                scope_values = []
                for field in scope_fields:
                    val = context.get(field)
                    if val is not None:
                        scope_values.append(str(val))
                if scope_values:
                    scope_key = ":".join(scope_values)
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
            seq_reset_rule = rule.seq_reset_rule or "never"
        
        # 获取或创建序号记录（不使用嵌套事务，避免死锁）
        sequence = await CodeSequence.get_or_none(
            code_rule_id=rule.id,
            tenant_id=tenant_id,
            scope_key=scope_key,
            deleted_at__isnull=True
        )
        if not sequence:
            sequence = await CodeSequence.create(
                code_rule_id=rule.id,
                tenant_id=tenant_id,
                scope_key=scope_key,
                current_seq=seq_start - seq_step
            )
        
        # 检查是否需要重置序号
        if seq_reset_rule and seq_reset_rule != "never":
            now = date.today()
            # 如果 reset_date 为空，初始化它但不重置序号（或者是第一次创建）
            if not sequence.reset_date:
                sequence.reset_date = now
            elif sequence.reset_date != now:
                if seq_reset_rule == "daily":
                    sequence.current_seq = seq_start - seq_step
                    sequence.reset_date = now
                elif seq_reset_rule == "monthly":
                    if sequence.reset_date.month != now.month or sequence.reset_date.year != now.year:
                        sequence.current_seq = seq_start - seq_step
                        sequence.reset_date = now
                elif seq_reset_rule == "yearly":
                    if sequence.reset_date.year != now.year:
                        sequence.current_seq = seq_start - seq_step
                        sequence.reset_date = now

        # 序列号校准：导入数据后库中可能已有更大序号，使 current_seq 不低于库中最大序号
        await CodeGenerationService._recalibrate_sequence_from_db(
            tenant_id=tenant_id,
            rule=rule,
            request_rule_code=rule_code,
            scope_key=scope_key,
            sequence=sequence,
            seq_step=seq_step,
            components=components,
        )
        
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
        
        # 如果没有自动计数组件，直接生成编码（不递增序号）
        if not counter_config and components:
            # 使用新格式（组件），序号传0（不会被使用）
            test_code = CodeRuleComponentService.render_components(
                components, 0, context
            )
            # 如果没有自动计数组件，仍然检查重复（如果设置了check_duplicate）
            # 因为编码可能基于上下文（如物料号+版本号），需要确保唯一性
            if check_duplicate and entity_type:
                is_duplicate = await CodeGenerationService._check_code_exists(
                    tenant_id=tenant_id,
                    code=test_code,
                    entity_type=entity_type
                )
                if is_duplicate:
                    # 如果编码已存在，返回空字符串（表示无法生成唯一编码）
                    # 这种情况应该由业务层处理（如提示用户修改版本号）
                    return ""
            return test_code
        
        # 获取序号配置（优先从组件读取，否则使用旧字段）
        scope_key = ""
        if counter_config:
            seq_start = counter_config.get("initial_value", 1)
            seq_step = 1  # 组件格式中步长固定为1
            seq_reset_rule = counter_config.get("reset_cycle", "never")
            
            # 计算 Scope Key
            scope_fields = counter_config.get("scope_fields", [])
            if scope_fields and context:
                scope_values = []
                for field in scope_fields:
                    val = context.get(field)
                    if val is not None:
                        scope_values.append(str(val))
                if scope_values:
                    scope_key = ":".join(scope_values)
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
            seq_reset_rule = rule.seq_reset_rule or "never"
        
        # 获取当前序号（不更新）
        sequence = await CodeSequence.get_or_none(
            code_rule_id=rule.id,
            tenant_id=tenant_id,
            scope_key=scope_key,
            deleted_at__isnull=True
        )
        
        # 计算预览序号，必须与正式生成逻辑完全一致
        if not sequence:
            test_seq = seq_start  # 正式生成会创建 seq_start-step 后自增得到 seq_start
        else:
            base_seq = sequence.current_seq
            # 与 generate_code 相同的重置检查（不写库）
            if seq_reset_rule and seq_reset_rule != "never":
                now = date.today()
                if not sequence.reset_date:
                     # 假设 reset_date 会被更新为 now
                     pass
                elif sequence.reset_date != now:
                    if seq_reset_rule == "daily":
                        base_seq = seq_start - seq_step
                    elif seq_reset_rule == "monthly":
                        if sequence.reset_date.month != now.month or sequence.reset_date.year != now.year:
                            base_seq = seq_start - seq_step
                    elif seq_reset_rule == "yearly":
                        if sequence.reset_date.year != now.year:
                             base_seq = seq_start - seq_step
            test_seq = base_seq + seq_step
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
        
        if entity_type == 'process_route':
            from apps.master_data.models.process import ProcessRoute
            # 检查未删除的记录（同一编码可以有多个版本，这里只检查编码是否存在）
            # 注意：工艺路线支持同一编码有多个版本，所以这里只检查编码是否存在
            existing = await ProcessRoute.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None
        
        if entity_type == 'bom':
            from apps.master_data.models.material import BOM
            # 检查BOM编码是否已存在
            existing = await BOM.filter(
                tenant_id=tenant_id,
                bom_code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None

        if entity_type == 'sales_order':
            from apps.kuaizhizao.models.demand import Demand
            # 检查销售订单（需求类型为 sales_order）编码是否已存在
            existing = await Demand.filter(
                tenant_id=tenant_id,
                demand_type='sales_order',
                demand_code=code,
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

    @staticmethod
    def _get_prefix_for_rule(rule: CodeRule, components: Optional[List[Dict[str, Any]]]) -> Optional[str]:
        """
        从规则中解析编码前缀（序号前的固定部分），用于从库中匹配已有编码并解析最大序号。
        组件格式：收集所有 fixed_text 按 order 排序后拼接（避免 order 相同或缺失时取不到前缀）。
        表达式格式：取 {SEQ 前的部分。
        """
        if components:
            sorted_comp = sorted(components, key=lambda x: x.get("order", 0))
            parts = [comp.get("text", "") for comp in sorted_comp if comp.get("type") == "fixed_text"]
            if parts:
                return "".join(parts)
        if rule.expression:
            m = re.match(r"^(.+?)\{SEQ", rule.expression)
            if m:
                return m.group(1)
        return None

    @staticmethod
    async def _get_max_sequence_from_db(
        tenant_id: int,
        rule_code: str,
        prefix: str,
    ) -> Optional[int]:
        """
        从库中查询该规则对应实体的编码字段，解析前缀后的数字部分，返回最大序号。
        用于导入数据后校准序列号，使新生成的序号接着已有数据往后排。
        """
        if not prefix:
            return None
        entity_config = RULE_CODE_ENTITY_FOR_SEQ_SYNC.get(rule_code)
        if not entity_config:
            return None
        module_path, class_name, attr_name = entity_config
        try:
            mod = importlib.import_module(module_path)
            model_class = getattr(mod, class_name, None)
            if not model_class:
                return None
            # 查询 tenant_id 下编码以 prefix 开头的记录（未软删）
            filter_kw = {"tenant_id": tenant_id, f"{attr_name}__startswith": prefix}
            if hasattr(model_class, "deleted_at"):
                filter_kw["deleted_at__isnull"] = True
            rows = await model_class.filter(**filter_kw).values_list(attr_name, flat=True)
            max_seq = None
            for code in rows:
                if not code or not str(code).startswith(prefix):
                    continue
                suffix = str(code)[len(prefix):].strip()
                if suffix.isdigit():
                    n = int(suffix)
                    if max_seq is None or n > max_seq:
                        max_seq = n
            return max_seq
        except Exception as e:
            logger.warning(
                "code_sequence_max_from_db_failed rule_code={} prefix={} error={}",
                rule_code,
                prefix,
                e,
            )
            return None

    @staticmethod
    async def _recalibrate_sequence_from_db(
        tenant_id: int,
        rule: CodeRule,
        request_rule_code: str,
        scope_key: str,
        sequence: CodeSequence,
        seq_step: int,
        components: Optional[List[Dict[str, Any]]],
    ) -> None:
        """
        根据库中已有编码的最大序号校准 current_seq，避免导入数据后新生成的序号与已有编码冲突。
        若库中最大序号大于当前 current_seq，则将 current_seq 设为该最大值（下次 += step 即为 max+1）。
        查找实体时同时尝试 rule.code 与请求的 request_rule_code，以兼容不同配置来源。
        """
        prefix = CodeGenerationService._get_prefix_for_rule(rule, components)
        if not prefix:
            logger.info(
                "code_sequence_recalibrate_skip rule_code={} reason=no_prefix rule_has_components={}",
                request_rule_code,
                bool(components),
            )
            return

        def _entity_config_for(code: Optional[str]) -> Optional[tuple]:
            if not code:
                return None
            c = RULE_CODE_ENTITY_FOR_SEQ_SYNC.get(code)
            if c:
                return c
            code_upper = code.upper()
            for k, v in RULE_CODE_ENTITY_FOR_SEQ_SYNC.items():
                if k.upper() == code_upper:
                    return v
            return None

        entity_config = _entity_config_for(rule.code) or _entity_config_for(request_rule_code)
        if not entity_config:
            logger.info(
                "code_sequence_recalibrate_skip rule_code={} rule.code={} reason=no_entity_config",
                request_rule_code,
                getattr(rule, "code", None),
            )
            return
        rule_code_for_lookup = (
            rule.code
            if _entity_config_for(rule.code)
            else request_rule_code
        )
        if not _entity_config_for(rule_code_for_lookup):
            rule_code_for_lookup = next(
                (k for k in RULE_CODE_ENTITY_FOR_SEQ_SYNC if k.upper() == (rule_code_for_lookup or "").upper()),
                rule_code_for_lookup,
            )
        max_from_db = await CodeGenerationService._get_max_sequence_from_db(
            tenant_id=tenant_id,
            rule_code=rule_code_for_lookup,
            prefix=prefix,
        )
        if max_from_db is None:
            logger.info(
                "code_sequence_recalibrate_skip rule_code={} prefix={} reason=max_from_db_is_none",
                rule_code_for_lookup,
                prefix,
            )
            return
        if sequence.current_seq < max_from_db:
            logger.info(
                "code_sequence_recalibrate rule_code={} prefix={} max_from_db={} current_seq_before={}",
                rule_code_for_lookup,
                prefix,
                max_from_db,
                sequence.current_seq,
            )
            sequence.current_seq = max_from_db
            await sequence.save()
        else:
            logger.debug(
                "code_sequence_recalibrate_skip rule_code={} current_seq={} max_from_db={} reason=already_ok",
                rule_code_for_lookup,
                sequence.current_seq,
                max_from_db,
            )

