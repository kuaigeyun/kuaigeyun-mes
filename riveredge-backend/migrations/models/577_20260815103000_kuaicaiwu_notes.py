"""
快财务票据台账（应收票据 / 应付票据）。

Author: AI Assistant
Date: 2026-08-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_notes" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "direction" VARCHAR(20) NOT NULL,
            "bill_type" VARCHAR(30) NOT NULL,
            "note_code" VARCHAR(50) NOT NULL,
            "bill_no" VARCHAR(100) NOT NULL,
            "amount" NUMERIC(14,2) NOT NULL,
            "issue_date" DATE NOT NULL,
            "due_date" DATE NOT NULL,
            "drawer_name" VARCHAR(200),
            "acceptor_name" VARCHAR(200),
            "payee_name" VARCHAR(200),
            "accepting_bank" VARCHAR(200),
            "customer_id" INT,
            "customer_name" VARCHAR(200),
            "supplier_id" INT,
            "supplier_name" VARCHAR(200),
            "receipt_id" INT,
            "payment_id" INT,
            "receivable_id" INT,
            "payable_id" INT,
            "status" VARCHAR(30) NOT NULL,
            "endorse_to_name" VARCHAR(200),
            "discount_bank" VARCHAR(200),
            "discount_date" DATE,
            "discount_interest" NUMERIC(14,2),
            "settle_date" DATE,
            "notes" TEXT,
            "attachments" JSONB,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_by" INT,
            "deleted_by_name" VARCHAR(100),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_notes_tenant"
            ON "apps_kuaicaiwu_notes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_notes_direction_status"
            ON "apps_kuaicaiwu_notes" ("tenant_id", "direction", "status");
        CREATE INDEX IF NOT EXISTS "idx_kuaicaiwu_notes_due_date"
            ON "apps_kuaicaiwu_notes" ("tenant_id", "due_date");
        CREATE UNIQUE INDEX IF NOT EXISTS "uidx_kuaicaiwu_notes_code"
            ON "apps_kuaicaiwu_notes" ("tenant_id", "note_code")
            WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaicaiwu_notes";
    """
