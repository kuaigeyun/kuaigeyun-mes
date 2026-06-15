from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_receivables"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_receivables"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_receipts"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_receipts"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_payables"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_payables"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_payments"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_payments"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_invoices"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_invoices"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_purchase_invoices"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_partner_statements"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_partner_statements"."attachments" IS '附件列表';

        ALTER TABLE "apps_kuaicaiwu_bank_accounts"
            ADD COLUMN IF NOT EXISTS "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaicaiwu_bank_accounts"."attachments" IS '附件列表';
    """
