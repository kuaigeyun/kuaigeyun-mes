"""采购入库按收货通知行占用，销售出库按发货通知行占用。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaizhizao_purchase_receipt_items"
    ADD COLUMN IF NOT EXISTS "receipt_notice_item_id" INT;

CREATE INDEX IF NOT EXISTS "idx_purchase_receipt_items_rn_item"
    ON "apps_kuaizhizao_purchase_receipt_items" ("receipt_notice_item_id");

ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
    ADD COLUMN IF NOT EXISTS "shipment_notice_item_id" INT;

CREATE INDEX IF NOT EXISTS "idx_sales_delivery_items_sn_item"
    ON "apps_kuaizhizao_sales_delivery_items" ("shipment_notice_item_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_purchase_receipt_items_rn_item";
ALTER TABLE "apps_kuaizhizao_purchase_receipt_items"
    DROP COLUMN IF EXISTS "receipt_notice_item_id";

DROP INDEX IF EXISTS "idx_sales_delivery_items_sn_item";
ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
    DROP COLUMN IF EXISTS "shipment_notice_item_id";
"""
