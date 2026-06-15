"""
调拨单明细增加调出/调入库区字段。

Author: AI Assistant
Date: 2026-06-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_inventory_transfer_items"
            ADD COLUMN IF NOT EXISTS "from_storage_area_id" INT,
            ADD COLUMN IF NOT EXISTS "from_storage_area_code" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "to_storage_area_id" INT,
            ADD COLUMN IF NOT EXISTS "to_storage_area_code" VARCHAR(50);

        COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."from_storage_area_id" IS '调出库区ID';
        COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."from_storage_area_code" IS '调出库区编码';
        COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."to_storage_area_id" IS '调入库区ID';
        COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfer_items"."to_storage_area_code" IS '调入库区编码';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_inventory_transfer_items"
            DROP COLUMN IF EXISTS "from_storage_area_id",
            DROP COLUMN IF EXISTS "from_storage_area_code",
            DROP COLUMN IF EXISTS "to_storage_area_id",
            DROP COLUMN IF EXISTS "to_storage_area_code";
    """
