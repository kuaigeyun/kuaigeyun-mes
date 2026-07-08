"""
批号规则服务模块

提供批号规则的 CRUD 和批号生成逻辑。
支持规则组件（固定文本、日期、物料编码、序号等）渲染。

Author: RiverEdge Team
Date: 2026-02-26
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal

from tortoise.expressions import Q

from core.models.batch_rule import BatchRule
from core.models.batch_rule_sequence import BatchRuleSequence
from core.services.code_rule.code_rule_component_service import CodeRuleComponentService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


class BatchRuleService:
    """批号规则服务"""

    @staticmethod
    async def get_rule_by_id(tenant_id: int, rule_id: int) -> Optional[BatchRule]:
        """根据ID获取批号规则"""
        return await BatchRule.filter(
            tenant_id=tenant_id,
            id=rule_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def get_rule_by_uuid(tenant_id: int, rule_uuid: str) -> Optional[BatchRule]:
        """根据UUID获取批号规则"""
        return await BatchRule.filter(
            tenant_id=tenant_id,
            uuid=rule_uuid,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def get_rule_by_code(tenant_id: int, code: str) -> Optional[BatchRule]:
        """根据规则代码获取批号规则"""
        return await BatchRule.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def list_rules(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[List[BatchRule], int]:
        """获取批号规则列表（支持关键词模糊、字段排序）"""
        from apps.master_data.services.master_data_list_core import apply_master_crud_list_filters

        await BatchRuleService.get_or_create_system_default(tenant_id)
        qs = BatchRule.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        qs, order_expr = apply_master_crud_list_filters(
            qs,
            keyword=keyword,
            code=code,
            name=name,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_by,
            sort_order=sort_order,
            default_sort_col="name",
        )
        total = await qs.count()
        rules = await qs.order_by(order_expr).offset((page - 1) * page_size).limit(page_size).all()
        return rules, total

    # 系统默认批号规则代码（未配置时使用）
    SYSTEM_DEFAULT_CODE = "BATCH_DEFAULT"

    @staticmethod
    async def get_or_create_system_default(tenant_id: int) -> BatchRule:
        """
        获取或创建系统默认批号规则。
        格式：YYYYMMDD-序号（3位，每日重置）
        """
        rule = await BatchRuleService.get_rule_by_code(tenant_id, BatchRuleService.SYSTEM_DEFAULT_CODE)
        if rule:
            return rule
        default_components = [
            {"type": "date", "order": 0, "format_type": "preset", "preset_format": "YYYYMMDD"},
            {"type": "fixed_text", "order": 1, "text": "-"},
            {"type": "auto_counter", "order": 2, "digits": 3, "fixed_width": True, "reset_cycle": "daily", "initial_value": 1},
        ]
        rule = await BatchRuleService.create_rule(
            tenant_id,
            {
                "name": "系统默认批号规则",
                "code": BatchRuleService.SYSTEM_DEFAULT_CODE,
                "rule_components": default_components,
                "description": "未配置专属规则时使用，格式：YYYYMMDD-序号（3位，每日重置）",
                "is_system": True,
                "is_active": True,
            },
        )
        logger.info(f"为租户 {tenant_id} 创建系统默认批号规则: {rule.code}")
        return rule

    @staticmethod
    async def create_rule(tenant_id: int, data: dict) -> BatchRule:
        """创建批号规则"""
        from datetime import datetime
        rule = await BatchRule.create(
            tenant_id=tenant_id,
            name=data["name"],
            code=data["code"],
            rule_components=data.get("rule_components"),
            description=data.get("description"),
            seq_start=data.get("seq_start", 1),
            seq_step=data.get("seq_step", 1),
            seq_reset_rule=data.get("seq_reset_rule"),
            is_system=data.get("is_system", False),
            is_active=data.get("is_active", True),
        )
        return rule

    @staticmethod
    async def update_rule(tenant_id: int, rule_uuid: str, data: dict) -> BatchRule:
        """更新批号规则"""
        rule = await BatchRule.filter(
            tenant_id=tenant_id, uuid=rule_uuid, deleted_at__isnull=True
        ).first()
        if not rule:
            raise NotFoundError("批号规则", rule_uuid)
        for k, v in data.items():
            if v is not None and hasattr(rule, k):
                setattr(rule, k, v)
        await rule.save()
        return rule

    @staticmethod
    async def delete_rule(tenant_id: int, rule_uuid: str) -> None:
        """软删除批号规则"""
        from datetime import datetime
        rule = await BatchRule.filter(
            tenant_id=tenant_id, uuid=rule_uuid, deleted_at__isnull=True
        ).first()
        if not rule:
            raise NotFoundError("批号规则", rule_uuid)
        if rule.is_system:
            raise ValidationError("系统规则不可删除")
        rule.deleted_at = datetime.utcnow()
        await rule.save()

    @staticmethod
    async def generate_by_rule(
        tenant_id: int,
        rule: BatchRule,
        context: Dict[str, Any],
        scope_key: str = "",
        *,
        preview: bool = False,
        preview_offset: int = 0,
    ) -> str:
        """
        根据批号规则生成批号

        Args:
            tenant_id: 租户ID
            rule: 批号规则
            context: 上下文变量（如 material_code, supplier_code 等）
            scope_key: 作用域Key（如物料ID，用于按物料隔离序号）
            preview: 为 True 时不占用流水号（不写 BatchRuleSequence），仅用于界面预览
            preview_offset: 预览时同一单据内多行同规则递增值（0,1,2…），仅 preview=True 时有效

        Returns:
            str: 生成的批号
        """
        off = max(0, int(preview_offset or 0))
        components = rule.get_rule_components()
        if not components:
            # 无组件时使用默认：{YYYYMMDD}-{序号}
            today = datetime.now().strftime("%Y%m%d")
            context.setdefault("material_code", "")
            if preview:
                base = await BatchRuleService._peek_next_seq(tenant_id, rule.id, scope_key)
                seq = base + off
            else:
                seq = await BatchRuleService._get_next_seq(tenant_id, rule.id, scope_key)
            return f"{today}-{str(seq).zfill(3)}"

        counter_config = CodeRuleComponentService.get_counter_component_config(components)
        if not counter_config:
            # 无计数组件，直接渲染
            return CodeRuleComponentService.render_components(components, 0, context)

        seq_start = counter_config.get("initial_value", 1)
        seq_step = 1
        seq_reset_rule = counter_config.get("reset_cycle", "never")

        if preview:
            base = await BatchRuleService._peek_next_seq_with_reset(
                tenant_id, rule.id, scope_key, seq_start, seq_step, seq_reset_rule
            )
            seq = base + off * seq_step
        else:
            seq = await BatchRuleService._get_next_seq_with_reset(
                tenant_id, rule.id, scope_key, seq_start, seq_step, seq_reset_rule
            )

        return CodeRuleComponentService.render_components(components, seq, context)

    @staticmethod
    async def _get_next_seq(
        tenant_id: int,
        rule_id: int,
        scope_key: str,
    ) -> int:
        """获取下一个序号（无重置）"""
        seq_rec, _ = await BatchRuleSequence.get_or_create(
            batch_rule_id=rule_id,
            tenant_id=tenant_id,
            scope_key=scope_key or "",
            defaults={"current_seq": 0},
        )
        seq_rec.current_seq += 1
        await seq_rec.save()
        return seq_rec.current_seq

    @staticmethod
    async def _get_next_seq_with_reset(
        tenant_id: int,
        rule_id: int,
        scope_key: str,
        seq_start: int,
        seq_step: int,
        seq_reset_rule: str,
    ) -> int:
        """获取下一个序号（支持按日/月/年重置）"""
        seq_rec, created = await BatchRuleSequence.get_or_create(
            batch_rule_id=rule_id,
            tenant_id=tenant_id,
            scope_key=scope_key or "",
            defaults={"current_seq": seq_start - seq_step, "reset_date": date.today()},
        )

        now = date.today()
        if not created and seq_rec.reset_date:
            if seq_reset_rule == "daily" and seq_rec.reset_date != now:
                seq_rec.current_seq = seq_start - seq_step
                seq_rec.reset_date = now
            elif seq_reset_rule == "monthly" and (
                seq_rec.reset_date.month != now.month or seq_rec.reset_date.year != now.year
            ):
                seq_rec.current_seq = seq_start - seq_step
                seq_rec.reset_date = now
            elif seq_reset_rule == "yearly" and seq_rec.reset_date.year != now.year:
                seq_rec.current_seq = seq_start - seq_step
                seq_rec.reset_date = now

        seq_rec.current_seq += seq_step
        await seq_rec.save()
        return seq_rec.current_seq

    @staticmethod
    async def _peek_next_seq(
        tenant_id: int,
        rule_id: int,
        scope_key: str,
    ) -> int:
        """预览：计算下一个序号（无重置逻辑分支），不写入 DB。与 _get_next_seq 首次及递增语义一致。"""
        seq_rec = await BatchRuleSequence.filter(
            batch_rule_id=rule_id,
            tenant_id=tenant_id,
            scope_key=scope_key or "",
        ).first()
        if not seq_rec:
            return 1
        return seq_rec.current_seq + 1

    @staticmethod
    async def _peek_next_seq_with_reset(
        tenant_id: int,
        rule_id: int,
        scope_key: str,
        seq_start: int,
        seq_step: int,
        seq_reset_rule: str,
    ) -> int:
        """预览：计算下一个序号（支持按日/月/年重置），不写入 DB。与 _get_next_seq_with_reset 一致。"""
        seq_rec = await BatchRuleSequence.filter(
            batch_rule_id=rule_id,
            tenant_id=tenant_id,
            scope_key=scope_key or "",
        ).first()
        now = date.today()
        if not seq_rec:
            return seq_start
        current = seq_rec.current_seq
        if seq_rec.reset_date:
            if seq_reset_rule == "daily" and seq_rec.reset_date != now:
                current = seq_start - seq_step
            elif seq_reset_rule == "monthly" and (
                seq_rec.reset_date.month != now.month or seq_rec.reset_date.year != now.year
            ):
                current = seq_start - seq_step
            elif seq_reset_rule == "yearly" and seq_rec.reset_date.year != now.year:
                current = seq_start - seq_step
        return current + seq_step
