"""
收货通知单明细增加行级入库仓库。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_receipt_notice_items"
        ADD COLUMN IF NOT EXISTS "warehouse_id" INT;
        ALTER TABLE "apps_kuaizhizao_receipt_notice_items"
        ADD COLUMN IF NOT EXISTS "warehouse_name" VARCHAR(100);
        COMMENT ON COLUMN "apps_kuaizhizao_receipt_notice_items"."warehouse_id"
            IS '行入库仓库ID（可与表头不同）';
        COMMENT ON COLUMN "apps_kuaizhizao_receipt_notice_items"."warehouse_name"
            IS '行入库仓库名称';
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_rni_warehouse"
            ON "apps_kuaizhizao_receipt_notice_items" ("warehouse_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_rni_warehouse";
        ALTER TABLE "apps_kuaizhizao_receipt_notice_items"
        DROP COLUMN IF EXISTS "warehouse_name";
        ALTER TABLE "apps_kuaizhizao_receipt_notice_items"
        DROP COLUMN IF EXISTS "warehouse_id";
    """
