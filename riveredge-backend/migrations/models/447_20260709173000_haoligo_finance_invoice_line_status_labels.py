"""
好力 GO — 发票明细行核对状态文案（缺失单价/需改价 → 未登记/差异）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_finance_invoice_line"
        SET "line_status" = '未登记'
        WHERE "line_status" = '缺失单价';

        UPDATE "haoligo_finance_invoice_line"
        SET "line_status" = '差异'
        WHERE "line_status" = '需改价';

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "line_status" SET DEFAULT '未登记';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_finance_invoice_line"
        SET "line_status" = '缺失单价'
        WHERE "line_status" = '未登记';

        UPDATE "haoligo_finance_invoice_line"
        SET "line_status" = '需改价'
        WHERE "line_status" = '差异';

        ALTER TABLE "haoligo_finance_invoice_line"
            ALTER COLUMN "line_status" SET DEFAULT '缺失单价';
    """
