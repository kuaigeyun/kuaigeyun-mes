"""
好力 GO — 财务付款记录。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_finance_payment" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "supplier_id" INT NOT NULL REFERENCES "haoligo_finance_supplier" ("id") ON DELETE RESTRICT,
            "payment_date" DATE NOT NULL,
            "amount" DECIMAL(18,2) NOT NULL,
            "payment_method" VARCHAR(32) NOT NULL,
            "contract_no" VARCHAR(128),
            "remark" TEXT,
            "acceptance_id" INT REFERENCES "haoligo_finance_material_acceptance" ("id") ON DELETE SET NULL,
            "invoice_id" INT REFERENCES "haoligo_finance_invoice" ("id") ON DELETE SET NULL,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pay_tenant" ON "haoligo_finance_payment" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pay_supplier" ON "haoligo_finance_payment" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pay_date" ON "haoligo_finance_payment" ("payment_date");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_pay_acc" ON "haoligo_finance_payment" ("acceptance_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_finance_payment" CASCADE;
    """
