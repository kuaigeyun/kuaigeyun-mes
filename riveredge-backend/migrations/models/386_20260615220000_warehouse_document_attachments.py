from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_batching_orders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_batching_orders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_purchase_receipts"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_receipts"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_other_inbounds"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_other_inbounds"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_material_returns"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_material_returns"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_customer_material_registrations"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_customer_material_registrations"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_sales_deliveries"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_deliveries"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_other_outbounds"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_other_outbounds"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_material_borrows"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_material_borrows"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_delivery_notices"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_delivery_notices"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_stocktakings"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_stocktakings"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_inventory_transfers"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_inventory_transfers"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_assembly_orders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_assembly_orders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_disassembly_orders"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_disassembly_orders"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_inventory_alert_rules"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_inventory_alert_rules"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaizhizao_barcode_mapping_rules"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_barcode_mapping_rules"."attachments" IS '附件列表';
    """
