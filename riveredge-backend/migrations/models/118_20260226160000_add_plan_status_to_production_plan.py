"""
为生产计划添加 plan_status 字段

支持计划先行流程：draft | submitted | approved | locked | executing

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 plan_status 字段
    """
    return """
        ALTER TABLE "apps_kuaizhizao_production_plans"
        ADD COLUMN IF NOT EXISTS "plan_status" VARCHAR(20) DEFAULT 'draft';
        COMMENT ON COLUMN "apps_kuaizhizao_production_plans"."plan_status" IS '计划状态：draft=草稿, submitted=已提交, approved=已审核, locked=已锁定, executing=执行中';
        UPDATE "apps_kuaizhizao_production_plans" SET plan_status = 'draft' WHERE plan_status IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除 plan_status 字段
    """
    return """
        ALTER TABLE "apps_kuaizhizao_production_plans"
        DROP COLUMN IF EXISTS "plan_status";
    """
