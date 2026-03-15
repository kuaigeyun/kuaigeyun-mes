"""
添加物料材质（texture）字段

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" ADD COLUMN IF NOT EXISTS "texture" VARCHAR(100) NULL;
        COMMENT ON COLUMN "apps_master_data_materials"."texture" IS '材质（如：钢、塑料、铝合金等）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "texture";
    """
