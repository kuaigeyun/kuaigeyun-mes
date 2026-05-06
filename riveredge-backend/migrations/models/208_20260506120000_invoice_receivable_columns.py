"""
销项发票表增加 receivable_id / receivable_code，与采购发票 payable 关联对称。

Author: Auto
Date: 2026-05-06
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_invoices" ADD COLUMN IF NOT EXISTS "receivable_id" INT;
        ALTER TABLE "apps_kuaicaiwu_invoices" ADD COLUMN IF NOT EXISTS "receivable_code" VARCHAR(50);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_invoices" DROP COLUMN IF EXISTS "receivable_code";
        ALTER TABLE "apps_kuaicaiwu_invoices" DROP COLUMN IF EXISTS "receivable_id";
    """
