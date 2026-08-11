"""
委外收货单补充对账所需质检字段：不合格原因、工废、料废。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        ADD COLUMN IF NOT EXISTS "nonconformance_reason" TEXT;

        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        ADD COLUMN IF NOT EXISTS "process_waste_qty" NUMERIC(12,2);

        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        ADD COLUMN IF NOT EXISTS "material_waste_qty" NUMERIC(12,2);

        COMMENT ON COLUMN "apps_kuaizhizao_outsource_material_receipts"."nonconformance_reason"
            IS '不合格原因';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_material_receipts"."process_waste_qty"
            IS '工废数量';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_material_receipts"."material_waste_qty"
            IS '料废数量';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        DROP COLUMN IF EXISTS "material_waste_qty";
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        DROP COLUMN IF EXISTS "process_waste_qty";
        ALTER TABLE "apps_kuaizhizao_outsource_material_receipts"
        DROP COLUMN IF EXISTS "nonconformance_reason";
    """
