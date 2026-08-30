"""销项红字发票：从蓝字回填关联应收（红冲写路径曾漏复制 receivable_id/code）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaicaiwu_invoices" AS red
        SET
            "receivable_id" = blue."receivable_id",
            "receivable_code" = blue."receivable_code"
        FROM "apps_kuaicaiwu_invoices" AS blue
        WHERE red."original_invoice_id" = blue."id"
          AND red."tenant_id" = blue."tenant_id"
          AND red."category" = 'OUT'
          AND red."deleted_at" IS NULL
          AND blue."deleted_at" IS NULL
          AND red."receivable_id" IS NULL
          AND blue."receivable_id" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: red invoice receivable backfill is irreversible"
