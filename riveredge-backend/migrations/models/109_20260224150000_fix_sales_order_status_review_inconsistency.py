"""
修复销售订单 status 与 review_status 不一致的脏数据

当 review_status 已为 APPROVED（审核通过）但 status 仍为 PENDING_REVIEW（待审核）时，
将 status 更新为 AUDITED，与 review_status 保持一致。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
    UPDATE apps_kuaizhizao_sales_orders
    SET status = 'AUDITED'
    WHERE deleted_at IS NULL
      AND review_status IN ('APPROVED', '审核通过', '通过', '已通过')
      AND status IN ('PENDING_REVIEW', '待审核', '已提交', 'PENDING');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 不自动回滚，避免误将正常已审核订单改回待审核
    return ""
