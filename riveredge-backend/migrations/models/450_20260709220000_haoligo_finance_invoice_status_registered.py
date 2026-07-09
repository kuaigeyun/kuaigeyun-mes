"""
好力 GO — 发票状态：待核对 → 已登记（创建即为已登记，取消事后核对动作）。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_finance_invoice"
        SET "status" = '已登记'
        WHERE "status" = '待核对';

        ALTER TABLE "haoligo_finance_invoice"
            ALTER COLUMN "status" SET DEFAULT '已登记';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "haoligo_finance_invoice"
        SET "status" = '待核对'
        WHERE "status" = '已登记';

        ALTER TABLE "haoligo_finance_invoice"
            ALTER COLUMN "status" SET DEFAULT '待核对';
    """
