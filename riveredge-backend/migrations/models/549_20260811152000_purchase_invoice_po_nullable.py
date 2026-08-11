"""
进项发票采购订单可空：无 PO 的应付单也可开进项。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
        ALTER COLUMN "purchase_order_id" DROP NOT NULL;

        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
        ALTER COLUMN "purchase_order_code" DROP NOT NULL;

        COMMENT ON COLUMN "apps_kuaicaiwu_purchase_invoices"."purchase_order_id"
            IS '采购订单ID（可选；从无订单应付开票时可空）';
        COMMENT ON COLUMN "apps_kuaicaiwu_purchase_invoices"."purchase_order_code"
            IS '采购订单编码（可选）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaicaiwu_purchase_invoices"
        SET "purchase_order_id" = 0
        WHERE "purchase_order_id" IS NULL;

        UPDATE "apps_kuaicaiwu_purchase_invoices"
        SET "purchase_order_code" = COALESCE("purchase_order_code", '')
        WHERE "purchase_order_code" IS NULL;

        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
        ALTER COLUMN "purchase_order_id" SET NOT NULL;

        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
        ALTER COLUMN "purchase_order_code" SET NOT NULL;
    """
