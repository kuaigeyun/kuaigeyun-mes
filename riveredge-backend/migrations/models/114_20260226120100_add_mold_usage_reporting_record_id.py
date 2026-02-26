"""
模具使用记录表新增 reporting_record_id 字段

用于关联报工记录，避免报工自动累计时重复创建使用记录。

Author: AI Assistant
Date: 2026-02-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为模具使用记录表添加 reporting_record_id 字段
    """
    return """
        -- ============================================
        -- 模具使用记录表新增 reporting_record_id
        -- ============================================
        ALTER TABLE "apps_kuaizhizao_mold_usages"
        ADD COLUMN IF NOT EXISTS "reporting_record_id" INT NULL;

        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_mold_usages_reporting_record_id"
        ON "apps_kuaizhizao_mold_usages" ("reporting_record_id");

        COMMENT ON COLUMN "apps_kuaizhizao_mold_usages"."reporting_record_id" IS '报工记录ID，用于关联报工避免重复累计';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除 reporting_record_id 字段
    """
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_mold_usages_reporting_record_id";
        ALTER TABLE "apps_kuaizhizao_mold_usages"
        DROP COLUMN IF EXISTS "reporting_record_id";
    """
