"""付款申请：付款事由/方式/发票情况/付款条件（对齐请款审批常用栏位）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            ADD COLUMN IF NOT EXISTS "payment_reason" TEXT;
        COMMENT ON COLUMN "apps_kuaizhizao_payment_applications"."payment_reason"
            IS '付款事由';
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaizhizao_payment_applications"."payment_method"
            IS '付款方式';
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            ADD COLUMN IF NOT EXISTS "invoice_status" VARCHAR(50);
        COMMENT ON COLUMN "apps_kuaizhizao_payment_applications"."invoice_status"
            IS '发票情况';
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(200);
        COMMENT ON COLUMN "apps_kuaizhizao_payment_applications"."payment_terms"
            IS '付款条件';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            DROP COLUMN IF EXISTS "payment_reason";
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            DROP COLUMN IF EXISTS "payment_method";
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            DROP COLUMN IF EXISTS "invoice_status";
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            DROP COLUMN IF EXISTS "payment_terms";
    """
