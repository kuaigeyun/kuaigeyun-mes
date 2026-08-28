from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_milestones"
            ADD COLUMN IF NOT EXISTS "is_prepayment" BOOL NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_sales_order_milestones"
            ADD COLUMN IF NOT EXISTS "bank_account_id" INT;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_milestones"."is_prepayment"
            IS '是否预收节点（审单自动生成预收收款单）';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_milestones"."bank_account_id"
            IS '预收银行账户ID';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_milestones"
            DROP COLUMN IF EXISTS "bank_account_id";
        ALTER TABLE "apps_kuaizhizao_sales_order_milestones"
            DROP COLUMN IF EXISTS "is_prepayment";
    """
