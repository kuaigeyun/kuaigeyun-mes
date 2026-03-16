"""
BOM 表增加配置位管理字段

- is_configurable: 是否为配置位（用户在下单/开工单时选择）
- configurable_group_id: 配置位组ID（同组多行=该位置的可选物料）
- is_default_configurable: 配置位组内是否为默认选项

与替代料互斥：同一 BOM 行不能同时为替代料和配置位。

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "is_configurable" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "configurable_group_id" INT NULL;
        ALTER TABLE "apps_master_data_bom" ADD COLUMN IF NOT EXISTS "is_default_configurable" BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_master_data_bom"."is_configurable" IS '是否为配置位（用户在下单/开工单时选择）';
        COMMENT ON COLUMN "apps_master_data_bom"."configurable_group_id" IS '配置位组ID（同组多行=该位置的可选物料）';
        COMMENT ON COLUMN "apps_master_data_bom"."is_default_configurable" IS '配置位组内是否为默认选项';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_bom" DROP COLUMN IF EXISTS "is_configurable";
        ALTER TABLE "apps_master_data_bom" DROP COLUMN IF EXISTS "configurable_group_id";
        ALTER TABLE "apps_master_data_bom" DROP COLUMN IF EXISTS "is_default_configurable";
    """
