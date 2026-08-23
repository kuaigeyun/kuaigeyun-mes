"""
编码生成服务模块

提供根据编码规则生成编码的功能。
支持序列号校准：从库中取当前最大已用序号，使新生成的序号不低于 max+1（按最大号往后排）。
- 导入较大序号后会与序号表对齐，避免冲突。
- 删除较大序号后不回落填洞（避免合并发号等「先 generate 后落库」场景撞号）。
- 规则无固定前缀（仅流水/表单字段+流水）时，仍从物料 main_code 末尾解析数字做校准。
- 物料主编码若含分组等表单字段：用「序号前完整前缀」（与生成规则一致，如分组码 0303）在库内取该分组下最大流水，再 +1；不按全库/不按洞填号。
"""

from typing import Optional, Dict, List, Any
from datetime import datetime
import re
import importlib

from loguru import logger
from tortoise.transactions import in_transaction

from core.models.code_rule import CodeRule
from core.models.code_sequence import CodeSequence
from core.models.model_fields import model_has_field
from core.services.business.code_rule_service import CodeRuleService
from core.services.code_rule.code_rule_component_service import CodeRuleComponentService
from core.config.code_rule_pages import get_seq_sync_entity_for_rule
from infra.exceptions.exceptions import ValidationError
from core.utils.timezone_utils import resolve_business_datetime, to_site_date

# snake_case <-> camelCase 映射（用于 scope_fields 与 context 的兼容）
_SCOPE_FIELD_ALIASES = {
    "group_code": "groupCode",
    "group_name": "groupName",
    "source_type": "sourceType",
}


def _get_context_value(context: Dict, field: str) -> Any:
    """从 context 获取字段值，兼容 snake_case 与 camelCase"""
    val = context.get(field)
    if val is not None and str(val).strip():
        return val
    alias = _SCOPE_FIELD_ALIASES.get(field)
    if alias:
        val = context.get(alias)
        if val is not None and str(val).strip():
            return val
    # 反向：若 field 是 camelCase，尝试 snake_case
    for sn, cam in _SCOPE_FIELD_ALIASES.items():
        if cam == field:
            val = context.get(sn)
            if val is not None and str(val).strip():
                return val
            break
    return None


def _count_group_code_fields_before_counter(
    components: Optional[List[Dict[str, Any]]],
) -> int:
    """统计自动序号之前 group_code 表单组件个数。"""
    if not components:
        return 0
    count = 0
    for comp in sorted(components, key=lambda x: x.get("order", 0)):
        if comp.get("type") == "auto_counter":
            break
        if comp.get("type") == "form_field" and (comp.get("field_name") or "") == "group_code":
            count += 1
    return count


def _get_form_field_value_for_render(
    context: Optional[Dict[str, Any]],
    field_name: str,
    *,
    group_code_field_index: int,
    group_code_field_total: int = 0,
) -> Any:
    """
    渲染表单字段值。物料规则中的 group_code 一律只取物料所属末级分组的编号。
    """
    if not context or not field_name:
        return None
    if field_name == "group_code":
        leaf = _get_leaf_group_code(context)
        return leaf if leaf else None
    return _get_context_value(context, field_name)


def _get_leaf_group_code(context: Optional[Dict[str, Any]]) -> str:
    """物料所属末级（material.group_id 对应分组）的编号，用于编号前缀与流水隔离。"""
    if not context:
        return ""
    leaf = context.get("leaf_group_code")
    if leaf is not None and str(leaf).strip():
        return str(leaf).strip()
    val = _get_context_value(context, "group_code")
    return str(val).strip() if val is not None else ""


def _get_group_code_levels_joined(context: Optional[Dict[str, Any]]) -> str:
    """物料编号前缀：仅末级分组编号（不拼接祖先层级）。"""
    return _get_leaf_group_code(context)


def _build_scope_key(scope_fields: List[str], context: Optional[Dict[str, Any]]) -> str:
    """按隔离字段构建 scope_key；group_code 仅取末级分组编号。"""
    if not scope_fields or not context:
        return ""
    scope_values: List[str] = []
    for field in scope_fields:
        f = (field or "").strip()
        if not f:
            continue
        if f == "group_code":
            val = _get_leaf_group_code(context)
        else:
            val = _get_context_value(context, f)
        if val is not None and str(val).strip():
            scope_values.append(str(val).strip())
    return ":".join(scope_values)


def _rule_has_date_component(components: Optional[List[Dict[str, Any]]]) -> bool:
    return any((comp or {}).get("type") == "date" for comp in (components or []))


def _digit_str_is_legacy_dated_serial(digit_str: str) -> bool:
    """旧预设「YYYYMMDD + 短流水」拼成的数字，不能当作当前无日期规则的长流水。"""
    if len(digit_str) < 9 or not digit_str.isdigit():
        return False
    try:
        datetime.strptime(digit_str[:8], "%Y%m%d")
    except ValueError:
        return False
    return bool(digit_str[8:])


def _resolve_scan_prefix_for_sequence(
    components: Optional[List[Dict[str, Any]]],
    context: Optional[Dict[str, Any]],
    scope_key: str,
    static_prefix: str = "",
) -> Optional[str]:
    """
    解析库内流水校准前缀：与生成规则一致，物料分组编号仅末级（group_id 对应分组的 code）。

    若序号前存在表单字段但 context 无法渲染完整前缀，返回 None，由调用方跳过校准。
    禁止回退到「仅 fixed_text」前缀：否则会把日期等中间段吞进流水号，
    例如前缀 CG + 编码 CG202608120004 → 误解析为 202608120004，超出 int32。
    """
    dyn_prefix = _render_prefix_before_auto_counter(components, context)
    leaf_prefix = _get_leaf_group_code(context)

    if dyn_prefix is None:
        return None
    if dyn_prefix:
        return dyn_prefix
    return leaf_prefix or static_prefix


def _render_prefix_before_auto_counter(
    components: Optional[List[Dict[str, Any]]],
    context: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    与 render_components 一致，仅渲染「自动序号」之前的部分（固定字 + 表单字段 + 日期等）。
    用于按分组/前缀在库中查询最大流水号；若某表单字段在 context 中无值则返回 None。
    """
    if not components:
        return ""
    sorted_components = sorted(components, key=lambda x: x.get("order", 0))
    parts: List[str] = []
    group_code_field_index = 0
    group_code_field_total = _count_group_code_fields_before_counter(components)
    render_ctx = dict(context) if context else None
    if render_ctx is not None:
        render_ctx["_rule_components"] = components
    for comp in sorted_components:
        ct = comp.get("type")
        if ct == "auto_counter":
            break
        if ct == "fixed_text":
            parts.append(comp.get("text") or "")
        elif ct == "form_field":
            fn = comp.get("field_name") or ""
            val = (
                _get_form_field_value_for_render(
                    render_ctx,
                    fn,
                    group_code_field_index=group_code_field_index,
                    group_code_field_total=group_code_field_total,
                )
                if render_ctx
                else None
            )
            if fn == "group_code":
                group_code_field_index += 1
            if val is None or not str(val).strip():
                return None
            parts.append(str(val).strip())
        elif ct == "date":
            format_type = comp.get("format_type", "preset")
            now = resolve_business_datetime()
            if format_type == "preset":
                preset_format = comp.get("preset_format", "YYYYMMDD")
                format_map = {
                    "YYYYMMDD": "%Y%m%d",
                    "YYYYMM": "%Y%m",
                    "YYYY": "%Y",
                    "YYMMDD": "%y%m%d",
                    "YYMM": "%y%m",
                    "YY": "%y",
                }
                strftime_format = format_map.get(preset_format, "%Y%m%d")
                parts.append(now.strftime(strftime_format))
            else:
                custom_format = comp.get("custom_format", "yMd")
                strftime_format = custom_format.replace("yyyy", "%Y").replace("yy", "%y").replace("y", "%Y")
                strftime_format = strftime_format.replace("MM", "%m").replace("M", "%m")
                strftime_format = strftime_format.replace("dd", "%d").replace("d", "%d")
                parts.append(now.strftime(strftime_format))
    return "".join(parts)


class CodeGenerationService:
    """
    编码生成服务类
    
    提供根据编码规则生成编码的功能。
    """

    @staticmethod
    async def build_material_code_context_from_group(
        tenant_id: int,
        group: Any,
        *,
        source_type: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        构建物料编码规则上下文：仅使用物料所属末级分组（group）的 code，不拼接祖先层级。
        """
        context: Dict[str, Any] = {}
        if not group:
            if source_type:
                context["source_type"] = source_type
            if name:
                context["name"] = name
            return context

        leaf_code = (getattr(group, "code", None) or "").strip()
        if leaf_code:
            context["leaf_group_code"] = leaf_code
            context["group_code"] = leaf_code
            context["group_code_path"] = leaf_code
            context["leaf_group_id"] = getattr(group, "id", None)
            context["group_name"] = getattr(group, "name", None)
        if source_type:
            context["source_type"] = source_type
        if name:
            context["name"] = name
        return context
    
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
        # 获取编码规则（manifest rule_code 精确匹配）
        rule, effective_rule_code = await CodeRuleService.resolve_rule_by_code(
            tenant_id, rule_code, active_only=True
        )
        if not rule:
            raise ValidationError(f"编码规则 {rule_code} 不存在或未启用，请在「编码规则」中启用并保存该规则")

        rule_code = effective_rule_code

        _rc = (rule_code or "").upper()
        if ("MATERIAL" in _rc or _rc == "MATERIAL_CODE") and context:
            components_preview = rule.get_rule_components()
            needs_group = False
            if components_preview:
                for comp in components_preview:
                    if comp.get("type") == "form_field" and (comp.get("field_name") or "") == "group_code":
                        needs_group = True
                        break
            if needs_group and not _get_leaf_group_code(context):
                raise ValidationError(
                    "物料主编码规则需要末级物料分组编号，请选择已配置编号的末级分组"
                )
        
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
            
            # 计算 Scope Key（兼容 scope_fields 与 scopeFields，用于按字段隔离计数）
            scope_fields_raw = counter_config.get("scope_fields") or counter_config.get("scopeFields") or []
            scope_fields = [f for f in scope_fields_raw if f and str(f).strip()]
            # 物料主编码：规则未配置 scope_fields 但 context 有 group_code 时，按分组隔离流水号
            if not scope_fields and context and _get_context_value(context, "group_code"):
                _rc = (rule_code or "").upper()
                if "MATERIAL" in _rc or _rc == "MATERIAL_CODE":
                    scope_fields = ["group_code"]
            if scope_fields and context:
                scope_key = _build_scope_key(scope_fields, context)
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
            seq_reset_rule = rule.seq_reset_rule or "never"

        CodeGenerationService._assert_seq_sync_entity_bound(
            rule, rule_code, context, components
        )
        
        # 事务内对序号行加锁再递增，否则 FOR UPDATE 在语句结束后立即释放
        async with in_transaction():
            sequence = (
                await CodeSequence.filter(
                    code_rule_id=rule.id,
                    tenant_id=tenant_id,
                    scope_key=scope_key,
                    deleted_at__isnull=True,
                )
                .select_for_update()
                .first()
            )
            if not sequence:
                try:
                    sequence = await CodeSequence.create(
                        code_rule_id=rule.id,
                        tenant_id=tenant_id,
                        scope_key=scope_key,
                        current_seq=seq_start - seq_step,
                    )
                except Exception:
                    # 并发创建时回读并加锁
                    sequence = (
                        await CodeSequence.filter(
                            code_rule_id=rule.id,
                            tenant_id=tenant_id,
                            scope_key=scope_key,
                            deleted_at__isnull=True,
                        )
                        .select_for_update()
                        .first()
                    )
                    if not sequence:
                        raise
                else:
                    sequence = (
                        await CodeSequence.filter(id=sequence.id)
                        .select_for_update()
                        .first()
                    )

            # 检查是否需要重置序号（业务日历日与编码日期组件一致，用站点时区）
            if seq_reset_rule and seq_reset_rule != "never":
                now = to_site_date(resolve_business_datetime())
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
                context=context,
            )

            # 递增序号（持有行锁期间保存）
            sequence.current_seq += seq_step
            await sequence.save()
            current_seq = sequence.current_seq

        if not components:
            raise ValidationError(f"编码规则 {rule_code} 缺少 rule_components，请在编码规则页面重新保存")
        return CodeRuleComponentService.render_components(
            components, current_seq, context
        )

    @staticmethod
    async def generate_code_batch(
        tenant_id: int,
        rule_code: str,
        count: int,
        context: Optional[Dict] = None,
    ) -> List[str]:
        """
        一次事务内连续生成多个不重复编码（合并收/付款等多笔核销场景）。

        避免落库前多次单独 generate 时序号校准与库内最大号不同步而重复发号。
        """
        if count <= 0:
            return []
        if count == 1:
            code = await CodeGenerationService.generate_code(tenant_id, rule_code, context)
            return [code]

        rule, effective_rule_code = await CodeRuleService.resolve_rule_by_code(
            tenant_id, rule_code, active_only=True
        )
        if not rule:
            raise ValidationError(f"编码规则 {rule_code} 不存在或未启用，请在「编码规则」中启用并保存该规则")

        rule_code = effective_rule_code
        components = rule.get_rule_components()
        counter_config = None
        if components:
            counter_config = CodeRuleComponentService.get_counter_component_config(components)

        if not counter_config and components:
            rendered = CodeRuleComponentService.render_components(components, 0, context)
            return [rendered] * count

        scope_key = ""
        if counter_config:
            seq_start = counter_config.get("initial_value", 1)
            seq_step = 1
            seq_reset_rule = counter_config.get("reset_cycle", "never")
            scope_fields_raw = counter_config.get("scope_fields") or counter_config.get("scopeFields") or []
            scope_fields = [f for f in scope_fields_raw if f and str(f).strip()]
            if not scope_fields and context and _get_context_value(context, "group_code"):
                _rc = (rule_code or "").upper()
                if "MATERIAL" in _rc or _rc == "MATERIAL_CODE":
                    scope_fields = ["group_code"]
            if scope_fields and context:
                scope_key = _build_scope_key(scope_fields, context)
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
            seq_reset_rule = rule.seq_reset_rule or "never"

        CodeGenerationService._assert_seq_sync_entity_bound(
            rule, rule_code, context, components
        )

        codes: List[str] = []
        async with in_transaction():
            sequence = (
                await CodeSequence.filter(
                    code_rule_id=rule.id,
                    tenant_id=tenant_id,
                    scope_key=scope_key,
                    deleted_at__isnull=True,
                )
                .select_for_update()
                .first()
            )
            if not sequence:
                try:
                    sequence = await CodeSequence.create(
                        code_rule_id=rule.id,
                        tenant_id=tenant_id,
                        scope_key=scope_key,
                        current_seq=seq_start - seq_step,
                    )
                except Exception:
                    sequence = (
                        await CodeSequence.filter(
                            code_rule_id=rule.id,
                            tenant_id=tenant_id,
                            scope_key=scope_key,
                            deleted_at__isnull=True,
                        )
                        .select_for_update()
                        .first()
                    )
                    if not sequence:
                        raise
                else:
                    sequence = (
                        await CodeSequence.filter(id=sequence.id)
                        .select_for_update()
                        .first()
                    )

            if seq_reset_rule and seq_reset_rule != "never":
                now = to_site_date(resolve_business_datetime())
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

            await CodeGenerationService._recalibrate_sequence_from_db(
                tenant_id=tenant_id,
                rule=rule,
                request_rule_code=rule_code,
                scope_key=scope_key,
                sequence=sequence,
                seq_step=seq_step,
                components=components,
                context=context,
            )

            if not components:
                raise ValidationError(f"编码规则 {rule_code} 缺少 rule_components，请在编码规则页面重新保存")

            for _ in range(count):
                sequence.current_seq += seq_step
                codes.append(
                    CodeRuleComponentService.render_components(
                        components, sequence.current_seq, context
                    )
                )
            await sequence.save()

        return codes

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
        # 获取编码规则（含 page 别名回退）
        rule, effective_rule_code = await CodeRuleService.resolve_rule_by_code(
            tenant_id, rule_code, active_only=True
        )
        if not rule:
            raise ValidationError(f"编码规则 {rule_code} 不存在或未启用")
        rule_code = effective_rule_code
        
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
            
            # 计算 Scope Key（兼容 scope_fields 与 scopeFields，用于按字段隔离计数）
            scope_fields_raw = counter_config.get("scope_fields") or counter_config.get("scopeFields") or []
            scope_fields = [f for f in scope_fields_raw if f and str(f).strip()]
            # 物料主编码：规则未配置 scope_fields 但 context 有 group_code 时，按分组隔离流水号
            if not scope_fields and context and _get_context_value(context, "group_code"):
                _rc = (rule_code or "").upper()
                if "MATERIAL" in _rc or _rc == "MATERIAL_CODE":
                    scope_fields = ["group_code"]
            if scope_fields and context:
                scope_key = _build_scope_key(scope_fields, context)
        else:
            seq_start = rule.seq_start
            seq_step = rule.seq_step
            seq_reset_rule = rule.seq_reset_rule or "never"

        CodeGenerationService._assert_seq_sync_entity_bound(
            rule, rule_code, context, components
        )
        
        # 获取当前序号（不更新）
        sequence = await CodeSequence.get_or_none(
            code_rule_id=rule.id,
            tenant_id=tenant_id,
            scope_key=scope_key,
            deleted_at__isnull=True
        )
        
        # 计算预览序号，必须与正式生成逻辑完全一致（含库中最大号校准）
        max_from_db = await CodeGenerationService._resolve_max_sequence_from_db_for_rule(
            tenant_id=tenant_id,
            rule=rule,
            request_rule_code=rule_code,
            components=components,
            context=context,
            scope_key=scope_key,
        )
        if max_from_db is not None:
            test_seq = max_from_db + seq_step
        elif not sequence:
            test_seq = seq_start  # 正式生成会创建 seq_start-step 后自增得到 seq_start
        else:
            base_seq = sequence.current_seq
            # 与 generate_code 相同的重置检查（不写库；站点业务日）
            if seq_reset_rule and seq_reset_rule != "never":
                now = to_site_date(resolve_business_datetime())
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
        if not components:
            raise ValidationError(f"编码规则 {rule_code} 缺少 rule_components，请在编码规则页面重新保存")
        test_code = CodeRuleComponentService.render_components(
            components, test_seq, context
        )
        
        if check_duplicate and entity_type:
            max_attempts = 100
            attempt = 0
            while attempt < max_attempts:
                is_duplicate = await CodeGenerationService._check_code_exists(
                    tenant_id=tenant_id,
                    code=test_code,
                    entity_type=entity_type
                )
                if not is_duplicate:
                    return test_code
                test_seq += seq_step
                test_code = CodeRuleComponentService.render_components(
                    components, test_seq, context
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

        if entity_type == 'sop':
            from apps.master_data.models.process import SOP
            existing = await SOP.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
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
            from apps.kuaizhizao.models.sales_order import SalesOrder
            existing = await SalesOrder.filter(
                tenant_id=tenant_id,
                order_code=code,
                deleted_at__isnull=True,
            ).first()
            return existing is not None

        if entity_type == 'work_order':
            from apps.kuaizhizao.models.work_order import WorkOrder
            existing = await WorkOrder.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None

        if entity_type == 'equipment':
            from apps.kuaizhizao.models.equipment import Equipment
            existing = await Equipment.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None

        if entity_type == 'mold':
            from apps.kuaizhizao.models.mold import Mold
            existing = await Mold.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None

        if entity_type == 'tool':
            from apps.kuaizhizao.models.tool import Tool
            existing = await Tool.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None

        if entity_type == 'work_center':
            from apps.master_data.models.factory import WorkCenter
            existing = await WorkCenter.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            return existing is not None

        # 其他实体类型的检查可以在这里扩展
        return False
    
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

    # PostgreSQL bigint / Tortoise BigIntField 上限（core_code_sequences.current_seq）
    # 18 位流水 10^18-1 仍小于该值；超过则该条编码不参与校准，不中断开单。
    _INT64_MAX = 9223372036854775807

    @staticmethod
    def _parse_counter_suffix_int(
        code: Optional[str],
        prefix: str,
        digits: Optional[int] = None,
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[int]:
        """
        从完整编码中解析流水号：必须先剥掉「序号前完整前缀」（含日期/分组），
        剩余部分才是流水。prefix 为空时表示整段编码参与解析。

        规则配置了 digits 时，剩余数字长度不得超过该位数；更长说明前缀不完整
        （例如只剥了 CG，把 20260812 连进流水），该编码不参与校准，而不是截尾或丢弃。

        当前规则不含日期组件时，跳过旧预设「前缀+YYYYMMDD+短流水」拼出的编号，
        避免被读成 12 位流水（例如 CG202608070007）。
        """
        s = (code or "").strip()
        if not s:
            return None
        if prefix:
            if not s.startswith(prefix):
                return None
            rest = s[len(prefix) :].strip()
        else:
            rest = s
        if not rest:
            return None
        if rest.isdigit():
            digit_str = rest
        else:
            m = re.search(r"(\d+)$", rest)
            if not m:
                return None
            digit_str = m.group(1)
        if digits and digits > 0 and len(digit_str) > digits:
            return None
        if components is not None and not _rule_has_date_component(components):
            if _digit_str_is_legacy_dated_serial(digit_str):
                return None
        try:
            n = int(digit_str)
        except ValueError:
            return None
        if n > CodeGenerationService._INT64_MAX:
            return None
        return n

    @staticmethod
    def _resolve_entity_config_for_rule(
        rule: CodeRule,
        request_rule_code: str,
    ) -> Optional[tuple]:
        for key in (getattr(rule, "code", None), request_rule_code):
            if not key:
                continue
            cfg = get_seq_sync_entity_for_rule(str(key))
            if cfg:
                return cfg
        return None

    @staticmethod
    def _material_seq_sync_deferred(
        rule_code: str,
        context: Optional[Dict[str, Any]],
    ) -> bool:
        _rc = (rule_code or "").upper()
        if "MATERIAL" not in _rc and _rc != "MATERIAL_CODE":
            return False
        return not _get_leaf_group_code(context)

    @staticmethod
    def _assert_seq_sync_entity_bound(
        rule: CodeRule,
        request_rule_code: str,
        context: Optional[Dict[str, Any]],
        components: Optional[List[Dict[str, Any]]],
    ) -> None:
        counter = CodeRuleComponentService.get_counter_component_config(components or [])
        if not counter:
            return
        rc = request_rule_code or getattr(rule, "code", "") or ""
        if CodeGenerationService._material_seq_sync_deferred(rc, context):
            return
        if CodeGenerationService._resolve_entity_config_for_rule(rule, request_rule_code):
            return
        raise ValidationError(
            f"编码规则 {rc} 未绑定库内序号校准实体。"
            "请在 code_rule_entity_models.py 注册 ENTITY_MODEL_BY_RULE_CODE，"
            "并在 CODE_RULE_PAGES 启用 auto_generate。"
        )

    @staticmethod
    async def _get_max_sequence_from_db(
        tenant_id: int,
        entity_config: tuple,
        prefix: Optional[str],
        *,
        rule_code: str = "",
        digits: Optional[int] = None,
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[int]:
        """
        从库中查询该规则对应实体的编码字段，解析流水号数字，返回当前最大序号。
        用于校准 CodeSequence：删除记录后仍能根据库中最大号回落。
        prefix 为 None 表示无法安全确定扫描前缀，跳过校准。
        """
        if prefix is None:
            return None
        module_path, class_name, attr_name = entity_config
        try:
            mod = importlib.import_module(module_path)
            model_class = getattr(mod, class_name, None)
            if not model_class:
                return None
            # 空前缀：仅物料 main_code 支持（纯流水、或序号前仅有表单字段无固定字符时）
            if not prefix:
                if class_name != "Material" or attr_name != "main_code":
                    return None
                filter_kw: Dict[str, Any] = {"tenant_id": tenant_id}
                if model_has_field(model_class, "deleted_at"):
                    filter_kw["deleted_at__isnull"] = True
            else:
                filter_kw = {
                    "tenant_id": tenant_id,
                    f"{attr_name}__startswith": prefix,
                }
                if model_has_field(model_class, "deleted_at"):
                    filter_kw["deleted_at__isnull"] = True
            rows = await model_class.filter(**filter_kw).values_list(attr_name, flat=True)
            max_seq = None
            for code in rows:
                n = CodeGenerationService._parse_counter_suffix_int(
                    str(code) if code is not None else None,
                    prefix,
                    digits=digits,
                    components=components,
                )
                if n is None:
                    continue
                if max_seq is None or n > max_seq:
                    max_seq = n
            return max_seq
        except Exception as e:
            logger.warning(
                "code_sequence_max_from_db_failed rule_code={} prefix={!r} error={}",
                rule_code,
                prefix,
                e,
            )
            return None

    @staticmethod
    async def _resolve_max_sequence_from_db_for_rule(
        tenant_id: int,
        rule: CodeRule,
        request_rule_code: str,
        components: Optional[List[Dict[str, Any]]],
        context: Optional[Dict[str, Any]] = None,
        scope_key: str = "",
    ) -> Optional[int]:
        """
        解析规则对应实体在库中的最大流水序号。
        物料等带分组（form_field）的规则：用与生成编码一致的「序号前完整前缀」（含 group_code）扫库，按分组取 max+1，避免填洞、避免跨分组串号。
        物料规则下前缀仅含末级分组编号，与 scope_key（末级）一致。
        """
        static_prefix = CodeGenerationService._get_prefix_for_rule(rule, components) or ""
        scan_prefix = _resolve_scan_prefix_for_sequence(
            components, context, scope_key or "", static_prefix
        )
        if scan_prefix is None:
            logger.info(
                "code_sequence_max_from_db_skip rule_code={} reason=incomplete_scan_prefix",
                request_rule_code or getattr(rule, "code", "") or "",
            )
            return None
        # 物料规则：禁止空前缀全库扫号（否则会产生 1173 等无分组含义的纯数字编号）
        _rc = (request_rule_code or getattr(rule, "code", None) or "").upper()
        if not scan_prefix and "MATERIAL" in _rc and context and _get_leaf_group_code(context):
            return None

        entity_config = CodeGenerationService._resolve_entity_config_for_rule(
            rule, request_rule_code
        )
        if not entity_config:
            return None
        counter_config = CodeRuleComponentService.get_counter_component_config(components or [])
        digits = None
        if counter_config:
            raw_digits = counter_config.get("digits")
            if raw_digits is not None:
                try:
                    digits = int(raw_digits)
                except (TypeError, ValueError):
                    digits = None
        return await CodeGenerationService._get_max_sequence_from_db(
            tenant_id=tenant_id,
            entity_config=entity_config,
            prefix=scan_prefix,
            rule_code=request_rule_code or getattr(rule, "code", "") or "",
            digits=digits,
            components=components,
        )

    @staticmethod
    async def _recalibrate_sequence_from_db(
        tenant_id: int,
        rule: CodeRule,
        request_rule_code: str,
        scope_key: str,
        sequence: CodeSequence,
        seq_step: int,
        components: Optional[List[Dict[str, Any]]],
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        根据库中已有编码的最大序号校准 current_seq。

        仅当 max_from_db > current_seq 时上调，使下次 += step 不低于库中已用最大号+1。
        禁止把 current_seq 下调到 max_from_db：合并收款等场景会在落库前连续 generate 多次，
        若每次都回落到「库中最大号」会发号重复并撞唯一约束。
        删除最大号后允许留号空隙，不以复用已删号为目标。
        """
        static_p = CodeGenerationService._get_prefix_for_rule(rule, components) or ""
        log_prefix = _resolve_scan_prefix_for_sequence(
            components, context, scope_key or "", static_p
        )
        max_from_db = await CodeGenerationService._resolve_max_sequence_from_db_for_rule(
            tenant_id=tenant_id,
            rule=rule,
            request_rule_code=request_rule_code,
            components=components,
            context=context,
            scope_key=scope_key,
        )
        if max_from_db is None:
            # 规则已改为无日期长流水时，序号表里可能仍残留旧预设拼出的「日期+短序号」
            if (
                not _rule_has_date_component(components)
                and _digit_str_is_legacy_dated_serial(str(sequence.current_seq))
            ):
                reset_to = (rule.seq_start or 1) - seq_step
                logger.info(
                    "code_sequence_discard_legacy_dated_mash rule_code={} current_seq_before={} reset_to={}",
                    request_rule_code,
                    sequence.current_seq,
                    reset_to,
                )
                sequence.current_seq = reset_to
                await sequence.save()
                return
            logger.info(
                "code_sequence_recalibrate_skip rule_code={} prefix={} scope_key={} reason=max_from_db_is_none",
                request_rule_code,
                log_prefix,
                scope_key,
            )
            return

        if max_from_db > sequence.current_seq:
            logger.info(
                "code_sequence_recalibrate rule_code={} prefix={} effective_prefix={} scope_key={} max_from_db={} current_seq_before={}",
                request_rule_code,
                log_prefix,
                log_prefix,
                scope_key,
                max_from_db,
                sequence.current_seq,
            )
            sequence.current_seq = max_from_db
            await sequence.save()
        else:
            logger.debug(
                "code_sequence_recalibrate_skip rule_code={} current_seq={} max_from_db={} reason=already_ok_or_ahead",
                request_rule_code,
                sequence.current_seq,
                max_from_db,
            )


