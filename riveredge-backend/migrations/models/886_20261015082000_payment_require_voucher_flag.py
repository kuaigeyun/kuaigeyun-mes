"""付款申请/付款单：是否必须上传付款凭证。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            ADD COLUMN IF NOT EXISTS "require_payment_voucher" BOOL NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_kuaizhizao_payment_applications"."require_payment_voucher"
            IS '是否要求后续付款单上传付款凭证';
        ALTER TABLE "apps_kuaicaiwu_payments"
            ADD COLUMN IF NOT EXISTS "require_payment_voucher" BOOL NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN "apps_kuaicaiwu_payments"."require_payment_voucher"
            IS '是否必须上传付款凭证（来自付款申请要求）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_payment_applications"
            DROP COLUMN IF EXISTS "require_payment_voucher";
        ALTER TABLE "apps_kuaicaiwu_payments"
            DROP COLUMN IF EXISTS "require_payment_voucher";
    """
