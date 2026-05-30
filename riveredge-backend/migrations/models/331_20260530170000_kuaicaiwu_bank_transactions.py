"""
快财务缺口补齐：银行流水、收付款 bank_account_id
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_bank_transactions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bank_account_id" INT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "source_doc_type" VARCHAR(50),
    "source_doc_id" INT,
    "source_doc_code" VARCHAR(50),
    "summary" VARCHAR(500),
    "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_transactions_uuid"
    ON "apps_kuaicaiwu_bank_transactions" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_tx_tenant_account"
    ON "apps_kuaicaiwu_bank_transactions" ("tenant_id", "bank_account_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_bank_tx_source"
    ON "apps_kuaicaiwu_bank_transactions" ("source_doc_type", "source_doc_id");
COMMENT ON TABLE "apps_kuaicaiwu_bank_transactions" IS '管理会计 - 银行流水';

ALTER TABLE "apps_kuaicaiwu_receipts"
    ADD COLUMN IF NOT EXISTS "bank_account_id" INT;
ALTER TABLE "apps_kuaicaiwu_payments"
    ADD COLUMN IF NOT EXISTS "bank_account_id" INT;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_kuaicaiwu_payments" DROP COLUMN IF EXISTS "bank_account_id";
ALTER TABLE "apps_kuaicaiwu_receipts" DROP COLUMN IF EXISTS "bank_account_id";
DROP TABLE IF EXISTS "apps_kuaicaiwu_bank_transactions";
"""
