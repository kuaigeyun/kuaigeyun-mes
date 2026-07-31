from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "is_gift" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_sales_order_items"
            ADD COLUMN IF NOT EXISTS "gift_ref_unit_price" DECIMAL(10,2);
        ALTER TABLE "apps_kuaizhizao_quotation_items"
            ADD COLUMN IF NOT EXISTS "is_gift" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_quotation_items"
            ADD COLUMN IF NOT EXISTS "gift_ref_unit_price" DECIMAL(10,2);
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items"
            ADD COLUMN IF NOT EXISTS "is_gift" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items"
            ADD COLUMN IF NOT EXISTS "gift_ref_unit_price" DECIMAL(10,2);
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
            ADD COLUMN IF NOT EXISTS "is_gift" BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items"
            ADD COLUMN IF NOT EXISTS "gift_ref_unit_price" DECIMAL(10,2);
        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_items"."is_gift" IS '是否赠品';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_items"."gift_ref_unit_price" IS '赠品参考单价';
        COMMENT ON COLUMN "apps_kuaizhizao_quotation_items"."is_gift" IS '是否赠品';
        COMMENT ON COLUMN "apps_kuaizhizao_quotation_items"."gift_ref_unit_price" IS '赠品参考单价';
        COMMENT ON COLUMN "apps_kuaizhizao_shipment_notice_items"."is_gift" IS '是否赠品';
        COMMENT ON COLUMN "apps_kuaizhizao_shipment_notice_items"."gift_ref_unit_price" IS '赠品参考单价';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_delivery_items"."is_gift" IS '是否赠品';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_delivery_items"."gift_ref_unit_price" IS '赠品参考单价';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items" DROP COLUMN IF EXISTS "gift_ref_unit_price";
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items" DROP COLUMN IF EXISTS "is_gift";
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items" DROP COLUMN IF EXISTS "gift_ref_unit_price";
        ALTER TABLE "apps_kuaizhizao_shipment_notice_items" DROP COLUMN IF EXISTS "is_gift";
        ALTER TABLE "apps_kuaizhizao_quotation_items" DROP COLUMN IF EXISTS "gift_ref_unit_price";
        ALTER TABLE "apps_kuaizhizao_quotation_items" DROP COLUMN IF EXISTS "is_gift";
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "gift_ref_unit_price";
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "is_gift";
    """
