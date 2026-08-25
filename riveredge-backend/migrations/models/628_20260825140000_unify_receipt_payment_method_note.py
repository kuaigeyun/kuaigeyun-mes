"""
收款单/付款单 payment_method：支票、承兑汇票 统一回填为「票据」。

票种（银承/商承等）在应收/应付票据台账区分，收付款方式只保留「票据」。
"""

from tortoise import BaseDBAsyncClient


RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaicaiwu_receipts"
           SET "payment_method" = '票据'
         WHERE "payment_method" IN ('支票', '承兑汇票');
        UPDATE "apps_kuaicaiwu_payments"
           SET "payment_method" = '票据'
         WHERE "payment_method" IN ('支票', '承兑汇票');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 历史「支票」「承兑汇票」已合并，不可无损还原；保留空降级。
        SELECT 1;
    """
