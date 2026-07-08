"""
回填销售退货单 review_status：创建时误默认为「待审核」但未提交审批的历史数据。

未提交的单据 reviewer_id / review_time 均为空，应显示为「草稿」以便提交审核。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_sales_returns"
        SET
            "review_status" = '草稿',
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "deleted_at" IS NULL
          AND "review_status" = '待审核'
          AND "status" IN ('待退货', '草稿')
          AND "reviewer_id" IS NULL
          AND "review_time" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
