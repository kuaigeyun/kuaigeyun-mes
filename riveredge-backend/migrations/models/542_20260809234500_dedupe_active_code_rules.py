"""
软删除同租户同 code 的重复启用编码规则，仅保留最新一条。

重复 WORK_ORDER_CODE 等规则会导致各自独立序号从 1 起号，
合同/订单批量下推工单时撞 idx_apps_kuaizhizao_work_orders_tenant_code。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY tenant_id, code
                    ORDER BY updated_at DESC NULLS LAST, id DESC
                ) AS rn
            FROM core_code_rules
            WHERE deleted_at IS NULL
              AND is_active = TRUE
        )
        UPDATE core_code_rules AS r
        SET
            is_active = FALSE,
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        FROM ranked
        WHERE r.id = ranked.id
          AND ranked.rn > 1;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 重复规则已软删除，downgrade 不自动恢复以免再次撞号
        SELECT 1;
    """
