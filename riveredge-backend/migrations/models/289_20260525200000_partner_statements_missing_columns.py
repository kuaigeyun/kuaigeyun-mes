"""
补全 apps_kuaicaiwu_partner_statements 缺失列（旧表由 Tortoise 预建，288 未 ALTER）。

Author: AI Assistant
Date: 2026-05-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaicaiwu_partner_statements"
            ADD COLUMN IF NOT EXISTS "company_name" VARCHAR(200),
            ADD COLUMN IF NOT EXISTS "confirmed_by" INT,
            ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "sent_by" INT,
            ADD COLUMN IF NOT EXISTS "sent_channel" VARCHAR(30),
            ADD COLUMN IF NOT EXISTS "dispute_reason" TEXT,
            ADD COLUMN IF NOT EXISTS "disputed_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "created_by" INT;

        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_partner_stmt_tenant_partner_period"
            ON "apps_kuaicaiwu_partner_statements" ("tenant_id", "partner_id", "partner_type", "statement_period")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uidx_partner_stmt_tenant_partner_period";
        ALTER TABLE "apps_kuaicaiwu_partner_statements"
            DROP COLUMN IF EXISTS "company_name",
            DROP COLUMN IF EXISTS "confirmed_by",
            DROP COLUMN IF EXISTS "sent_at",
            DROP COLUMN IF EXISTS "sent_by",
            DROP COLUMN IF EXISTS "sent_channel",
            DROP COLUMN IF EXISTS "dispute_reason",
            DROP COLUMN IF EXISTS "disputed_at",
            DROP COLUMN IF EXISTS "created_by";
    """
