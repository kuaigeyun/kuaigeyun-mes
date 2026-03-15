"""
添加工序质检选项字段（inspection_mode、default_inspection_plan_id）

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_operations" ADD COLUMN IF NOT EXISTS "inspection_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
        COMMENT ON COLUMN "apps_master_data_operations"."inspection_mode" IS '质检模式（none:无质检, simple:简易质检, plan:方案质检）';
        ALTER TABLE "apps_master_data_operations" ADD COLUMN IF NOT EXISTS "default_inspection_plan_id" INT NULL;
        COMMENT ON COLUMN "apps_master_data_operations"."default_inspection_plan_id" IS '默认质检方案ID（方案质检时使用）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_operations" DROP COLUMN IF EXISTS "inspection_mode";
        ALTER TABLE "apps_master_data_operations" DROP COLUMN IF EXISTS "default_inspection_plan_id";
    """
