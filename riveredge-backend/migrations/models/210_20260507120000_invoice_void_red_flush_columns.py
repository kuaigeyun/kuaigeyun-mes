"""
销项/进项发票表增加作废说明、红冲关联字段（中国增值税实务：作废、红字发票）

Author: Auto
Date: 2026-05-07
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_invoices" ADD COLUMN IF NOT EXISTS "void_reason" TEXT;
        ALTER TABLE "apps_kuaicaiwu_invoices" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMPTZ;
        ALTER TABLE "apps_kuaicaiwu_invoices" ADD COLUMN IF NOT EXISTS "original_invoice_id" INT REFERENCES "apps_kuaicaiwu_invoices"("id") ON DELETE SET NULL;
        ALTER TABLE "apps_kuaicaiwu_invoices" ADD COLUMN IF NOT EXISTS "red_flush_invoice_id" INT REFERENCES "apps_kuaicaiwu_invoices"("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_inv_original" ON "apps_kuaicaiwu_invoices" ("original_invoice_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_inv_red_flush" ON "apps_kuaicaiwu_invoices" ("red_flush_invoice_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_kuaicaiwu_inv_red_flush";
        DROP INDEX IF EXISTS "idx_apps_kuaicaiwu_inv_original";
        ALTER TABLE "apps_kuaicaiwu_invoices" DROP COLUMN IF EXISTS "red_flush_invoice_id";
        ALTER TABLE "apps_kuaicaiwu_invoices" DROP COLUMN IF EXISTS "original_invoice_id";
        ALTER TABLE "apps_kuaicaiwu_invoices" DROP COLUMN IF EXISTS "voided_at";
        ALTER TABLE "apps_kuaicaiwu_invoices" DROP COLUMN IF EXISTS "void_reason";
    """
