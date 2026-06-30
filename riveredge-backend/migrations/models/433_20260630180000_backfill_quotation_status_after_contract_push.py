"""
回填报价单 status：已转销售合同但 status 仍为「已接受/已发送」等的历史数据。

转销售合同时原先只写入 contract_id，未同步 status，导致列表筛选与报表与「当前阶段」不一致。
仅更新 contract_id 仍指向未删除销售合同的报价单。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_quotations" AS q
        SET
            "status" = '已转订单',
            "updated_at" = CURRENT_TIMESTAMP
        FROM "apps_kuaizhizao_sales_contracts" AS sc
        WHERE q."contract_id" = sc."id"
          AND q."deleted_at" IS NULL
          AND sc."deleted_at" IS NULL
          AND q."contract_id" IS NOT NULL
          AND q."status" <> '已转订单';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
