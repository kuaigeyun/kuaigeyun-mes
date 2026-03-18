"""
可选：生产计划数据软删除（彻底清理）

生产计划功能已下线，若希望彻底清理历史生产计划数据，可执行本迁移：
- 对所有未删除的生产计划主表记录设置 deleted_at = NOW()（软删除）
- 明细表 production_plan_items 无 deleted_at 字段，随主表逻辑删除后不再被业务使用

执行前请确认已备份或不再需要生产计划历史数据。
不执行本迁移不影响系统运行，仅保留历史数据在库中。

Author: RiverEdge
Date: 2026-03-18
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：软删除所有生产计划主表记录
    """
    return """
        -- ============================================
        -- 可选：生产计划数据软删除（功能已下线）
        -- ============================================
        UPDATE "apps_kuaizhizao_production_plans"
        SET "deleted_at" = NOW()
        WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：恢复生产计划软删除（将 deleted_at 置空）
    """
    return """
        UPDATE "apps_kuaizhizao_production_plans"
        SET "deleted_at" = NULL
        WHERE "deleted_at" IS NOT NULL;
    """
