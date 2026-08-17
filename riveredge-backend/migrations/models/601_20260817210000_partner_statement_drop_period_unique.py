"""
往来对账单：取消「同一往来同一 YYYY-MM 仅一张」唯一约束

业务真源：按单据是否已纳入其它对账单去重；同一期间若仍有未纳入明细，允许再生成对账单。
原 uidx_partner_stmt_tenant_partner_period 会在仍有未对账单据时误拦创建。

Author: RiverEdge Team
Date: 2026-08-17
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uidx_partner_stmt_tenant_partner_period";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_partner_stmt_tenant_partner_period"
            ON "apps_kuaicaiwu_partner_statements" ("tenant_id", "partner_id", "partner_type", "statement_period")
            WHERE "deleted_at" IS NULL;
    """
