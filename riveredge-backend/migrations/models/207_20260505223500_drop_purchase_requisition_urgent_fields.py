"""
移除采购申请“紧急采购”遗留字段。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_requisitions"
            DROP COLUMN IF EXISTS "is_urgent",
            DROP COLUMN IF EXISTS "urgent_reason",
            DROP COLUMN IF EXISTS "urgent_operator_id",
            DROP COLUMN IF EXISTS "urgent_operated_at";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_requisitions"
            ADD COLUMN IF NOT EXISTS "is_urgent" BOOL NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS "urgent_reason" TEXT,
            ADD COLUMN IF NOT EXISTS "urgent_operator_id" INT,
            ADD COLUMN IF NOT EXISTS "urgent_operated_at" TIMESTAMPTZ;
    """
