"""
为 Demand 模型添加 priority 字段

需求管理支持设置优先级，生产排产时按优先级安排。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_demands"
        ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 5;

        COMMENT ON COLUMN "apps_kuaizhizao_demands"."priority" IS '优先级（1=高、5=中、10=低，默认5）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_demands"
        DROP COLUMN IF EXISTS "priority";
    """
