"""
为生产计划添加 needs_recompute 字段

上游变更时，若计划为 draft/submitted 可自动标记待重算（计划锁定策略）

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 needs_recompute 字段
    """
    return """
        ALTER TABLE "apps_kuaizhizao_production_plans"
        ADD COLUMN IF NOT EXISTS "needs_recompute" BOOLEAN DEFAULT FALSE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除 needs_recompute 字段
    """
    return """
        ALTER TABLE "apps_kuaizhizao_production_plans"
        DROP COLUMN IF EXISTS "needs_recompute";
    """
