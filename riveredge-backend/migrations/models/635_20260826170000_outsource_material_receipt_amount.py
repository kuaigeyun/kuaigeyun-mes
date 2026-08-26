"""委外收货单补齐单价与金额字段，并自委外工单回填历史数据。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        ADD COLUMN IF NOT EXISTS "unit_price" NUMERIC(14,4) NOT NULL DEFAULT 0;

        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        ADD COLUMN IF NOT EXISTS "total_amount" NUMERIC(14,4) NOT NULL DEFAULT 0;

        COMMENT ON COLUMN "apps_kuaizhizao_outsource_material_receipts"."unit_price"
            IS '委外单价快照（来自委外工单）';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_material_receipts"."total_amount"
            IS '收货金额（合格数量×单价）';

        UPDATE "apps_kuaizhizao_outsource_material_receipts" AS r
        SET
            "unit_price" = COALESCE(owo."unit_price", 0),
            "total_amount" = ROUND(
                (
                    CASE
                        WHEN COALESCE(r."qualified_quantity", 0) > 0
                        THEN r."qualified_quantity"
                        ELSE r."quantity"
                    END
                ) * COALESCE(owo."unit_price", 0),
                2
            )
        FROM "apps_kuaizhizao_outsource_work_orders" AS owo
        WHERE r."outsource_work_order_id" = owo."id"
          AND r."deleted_at" IS NULL
          AND owo."deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        DROP COLUMN IF EXISTS "total_amount";
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        DROP COLUMN IF EXISTS "unit_price";
    """
