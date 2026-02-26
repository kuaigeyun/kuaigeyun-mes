"""
修复设备、模具、工装编码规则为正确格式

将 EQUIPMENT_CODE、MOLD_CODE、TOOL_CODE 的规则从「日期+4位流水」改为「前缀+4位流水」：
- 设备：EQ + 4位流水（如 EQ0001）
- 模具：MOLD + 4位流水（如 MOLD0001）
- 工装：TOOL + 4位流水（如 TOOL0001）

使用方法（在项目根目录执行）:
    cd riveredge-backend && PYTHONPATH=src python -m core.scripts.fix_equipment_mold_tool_code_rules

Author: AI Assistant
Date: 2026-02-26
"""

import asyncio
import json
from loguru import logger

# 正确的规则组件（无日期，前缀+4位流水）
RULE_UPDATES = [
    {
        "code": "EQUIPMENT_CODE",
        "rule_components": [
            {"type": "fixed_text", "order": 0, "text": "EQ"},
            {"type": "auto_counter", "order": 1, "digits": 4, "fixed_width": True, "reset_cycle": "never", "initial_value": 1},
        ],
        "description": "设备管理编码规则，格式：EQ + 4位序号",
    },
    {
        "code": "MOLD_CODE",
        "rule_components": [
            {"type": "fixed_text", "order": 0, "text": "MOLD"},
            {"type": "auto_counter", "order": 1, "digits": 4, "fixed_width": True, "reset_cycle": "never", "initial_value": 1},
        ],
        "description": "模具管理编码规则，格式：MOLD + 4位序号",
    },
    {
        "code": "TOOL_CODE",
        "rule_components": [
            {"type": "fixed_text", "order": 0, "text": "TOOL"},
            {"type": "auto_counter", "order": 1, "digits": 4, "fixed_width": True, "reset_cycle": "never", "initial_value": 1},
        ],
        "description": "工装台账编码规则，格式：TOOL + 4位序号",
    },
]


async def fix_rules():
    """修复所有租户的设备、模具、工装编码规则"""
    import sys
    from pathlib import Path

    src = Path(__file__).resolve().parent.parent.parent
    if str(src) not in sys.path:
        sys.path.insert(0, str(src))

    from tortoise import Tortoise
    from infra.infrastructure.database.database import TORTOISE_ORM

    await Tortoise.init(config=TORTOISE_ORM)
    try:
        from core.models.code_rule import CodeRule

        # 先列出所有相关规则
        all_target_rules = await CodeRule.filter(
            code__in=[u["code"] for u in RULE_UPDATES],
            deleted_at__isnull=True,
        ).all()
        logger.info(f"找到 {len(all_target_rules)} 条待修复规则: {[r.code for r in all_target_rules]}")

        updated_count = 0
        for update in RULE_UPDATES:
            rules = await CodeRule.filter(
                code=update["code"],
                deleted_at__isnull=True,
            ).all()
            for rule in rules:
                rule.rule_components = update["rule_components"]
                rule.seq_reset_rule = "never"
                rule.description = update["description"]
                await rule.save()
                updated_count += 1
                logger.info(f"已更新租户 {rule.tenant_id} 的 {update['code']} 规则")
        logger.info(f"共更新 {updated_count} 条编码规则")
        return updated_count
    finally:
        await Tortoise.close_connections()


def main():
    asyncio.run(fix_rules())


if __name__ == "__main__":
    main()
