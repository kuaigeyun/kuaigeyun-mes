"""
发货通知单明细增加行级出库仓库；通知单增加关联多张销售出库单字段。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items"
        ADD COLUMN IF NOT EXISTS "warehouse_id" INT;
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items"
        ADD COLUMN IF NOT EXISTS "warehouse_name" VARCHAR(100);
        COMMENT ON COLUMN "apps_kuaizhizao_shipment_notice_items"."warehouse_id"
            IS '行出库仓库ID（可与表头不同）';
        COMMENT ON COLUMN "apps_kuaizhizao_shipment_notice_items"."warehouse_name"
            IS '行出库仓库名称';
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizhizao_sni_warehouse"
            ON "apps_kuaizhizao_shipment_notice_items" ("warehouse_id");

        ALTER TABLE "apps_kuaizhizao_shipment_notices"
        ADD COLUMN IF NOT EXISTS "related_sales_delivery_ids" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_shipment_notices"."related_sales_delivery_ids"
            IS '关联销售出库单列表（多仓发货时 [{id, code}, ...]）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_shipment_notices"
        DROP COLUMN IF EXISTS "related_sales_delivery_ids";

        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_sni_warehouse";
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items"
        DROP COLUMN IF EXISTS "warehouse_name";
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items"
        DROP COLUMN IF EXISTS "warehouse_id";
    """
