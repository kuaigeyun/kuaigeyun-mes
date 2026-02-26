"""
序列号规则服务模块

提供序列号规则的 CRUD 和序列号生成逻辑。
支持规则组件（固定文本、日期、物料编码、序号等）渲染。

Author: RiverEdge Team
Date: 2026-02-26
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date

from core.models.serial_rule import SerialRule
from core.models.serial_rule_sequence import SerialRuleSequence
from core.services.code_rule.code_rule_component_service import CodeRuleComponentService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


class SerialRuleService:
    """序列号规则服务"""

    @staticmethod
    async def get_rule_by_id(tenant_id: int, rule_id: int) -> Optional[SerialRule]:
        """根据ID获取序列号规则"""
        return await SerialRule.filter(
            tenant_id=tenant_id,
            id=rule_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def get_rule_by_uuid(tenant_id: int, rule_uuid: str) -> Optional[SerialRule]:
        """根据UUID获取序列号规则"""
        return await SerialRule.filter(
            tenant_id=tenant_id,
            uuid=rule_uuid,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def get_rule_by_code(tenant_id: int, code: str) -> Optional[SerialRule]:
        """根据规则代码获取序列号规则"""
        return await SerialRule.filter(
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
    ) -> tuple[List[SerialRule], int]:
        """获取序列号规则列表"""
        qs = SerialRule.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        total = await qs.count()
        rules = await qs.offset((page - 1) * page_size).limit(page_size).all()
        return rules, total

    @staticmethod
    async def create_rule(tenant_id: int, data: dict) -> SerialRule:
        """创建序列号规则"""
        rule = await SerialRule.create(
            tenant_id=tenant_id,
            name=data["name"],
            code=data["code"],
            rule_components=data.get("rule_components"),
            description=data.get("description"),
            seq_start=data.get("seq_start", 1),
            seq_step=data.get("seq_step", 1),
            seq_reset_rule=data.get("seq_reset_rule"),
            is_active=data.get("is_active", True),
        )
        return rule

    @staticmethod
    async def update_rule(tenant_id: int, rule_uuid: str, data: dict) -> SerialRule:
        """更新序列号规则"""
        rule = await SerialRule.filter(
            tenant_id=tenant_id, uuid=rule_uuid, deleted_at__isnull=True
        ).first()
        if not rule:
            raise NotFoundError("序列号规则", rule_uuid)
        if rule.is_system:
            raise ValidationError("系统规则不可删除")
        for k, v in data.items():
            if v is not None and hasattr(rule, k):
                setattr(rule, k, v)
        await rule.save()
        return rule

    @staticmethod
    async def delete_rule(tenant_id: int, rule_uuid: str) -> None:
        """软删除序列号规则"""
        from datetime import datetime
        rule = await SerialRule.filter(
            tenant_id=tenant_id, uuid=rule_uuid, deleted_at__isnull=True
        ).first()
        if not rule:
            raise NotFoundError("序列号规则", rule_uuid)
        if rule.is_system:
            raise ValidationError("系统规则不可删除")
        rule.deleted_at = datetime.utcnow()
        await rule.save()

    @staticmethod
    async def generate_by_rule(
        tenant_id: int,
        rule: SerialRule,
        context: Dict[str, Any],
        scope_key: str = "",
        count: int = 1,
    ) -> List[str]:
        """
        根据序列号规则生成序列号（批量）

        Args:
            tenant_id: 租户ID
            rule: 序列号规则
            context: 上下文变量（如 material_code 等）
            scope_key: 作用域Key（如物料ID）
            count: 生成数量

        Returns:
            List[str]: 生成的序列号列表
        """
        components = rule.get_rule_components()
        if not components:
            today = datetime.now().strftime("%Y%m%d")
            context.setdefault("material_code", "")
            result = []
            for _ in range(count):
                seq = await SerialRuleService._get_next_seq(tenant_id, rule.id, scope_key)
                result.append(f"{context.get('material_code', '')}-{today}-{str(seq).zfill(6)}")
            return result

        counter_config = CodeRuleComponentService.get_counter_component_config(components)
        if not counter_config:
            seq_str = CodeRuleComponentService.render_components(components, 0, context)
            return [seq_str] * count

        seq_start = counter_config.get("initial_value", 1)
        seq_step = 1
        seq_reset_rule = counter_config.get("reset_cycle", "never")

        result = []
        for _ in range(count):
            seq = await SerialRuleService._get_next_seq_with_reset(
                tenant_id, rule.id, scope_key, seq_start, seq_step, seq_reset_rule
            )
            result.append(CodeRuleComponentService.render_components(components, seq, context))

        return result

    @staticmethod
    async def _get_next_seq(
        tenant_id: int,
        rule_id: int,
        scope_key: str,
    ) -> int:
        """获取下一个序号（无重置）"""
        seq_rec, _ = await SerialRuleSequence.get_or_create(
            serial_rule_id=rule_id,
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
        seq_rec, created = await SerialRuleSequence.get_or_create(
            serial_rule_id=rule_id,
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
