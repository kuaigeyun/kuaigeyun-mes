"""
模具表新增腔数和设计寿命字段

为模具管理增加：
- cavity_count: 腔数/模数，一次成型产出件数，用于产量→使用次数换算
- design_lifetime: 设计寿命（使用次数），用于寿命预警

Author: AI Assistant
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为模具表添加 cavity_count、design_lifetime 字段
    """
    return """
        -- ============================================
        -- 模具表新增腔数和设计寿命字段
        -- ============================================
        ALTER TABLE "apps_kuaizhizao_molds"
        ADD COLUMN IF NOT EXISTS "cavity_count" INT NULL,
        ADD COLUMN IF NOT EXISTS "design_lifetime" INT NULL;

        COMMENT ON COLUMN "apps_kuaizhizao_molds"."cavity_count" IS '腔数/模数，一次成型产出件数，用于产量→使用次数换算';
        COMMENT ON COLUMN "apps_kuaizhizao_molds"."design_lifetime" IS '设计寿命（使用次数），用于寿命预警';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除 cavity_count、design_lifetime 字段
    """
    return """
        ALTER TABLE "apps_kuaizhizao_molds"
        DROP COLUMN IF EXISTS "cavity_count",
        DROP COLUMN IF EXISTS "design_lifetime";
    """
