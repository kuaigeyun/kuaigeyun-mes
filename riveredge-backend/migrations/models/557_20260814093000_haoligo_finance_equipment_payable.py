"""好力 GO — 设备合同登记 / 设备应付款 / 付款明细。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_finance_equipment_contract" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "supplier_id" INT NOT NULL REFERENCES "haoligo_finance_supplier" ("id") ON DELETE RESTRICT,
            "supplier_name" VARCHAR(200) NOT NULL,
            "contract_no" VARCHAR(128) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "tax_inclusive_amount" DECIMAL(18,2) NOT NULL,
            "contract_file_uuids" JSONB NOT NULL DEFAULT '[]',
            "reporter_user_id" INT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_contract_tenant"
            ON "haoligo_finance_equipment_contract" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_contract_supplier"
            ON "haoligo_finance_equipment_contract" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_contract_no"
            ON "haoligo_finance_equipment_contract" ("contract_no");
        COMMENT ON TABLE "haoligo_finance_equipment_contract" IS '好力GO - 设备合同登记';

        CREATE TABLE IF NOT EXISTS "haoligo_finance_equipment_payable" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "contract_id" INT NOT NULL REFERENCES "haoligo_finance_equipment_contract" ("id") ON DELETE RESTRICT,
            "supplier_id" INT NOT NULL REFERENCES "haoligo_finance_supplier" ("id") ON DELETE RESTRICT,
            "supplier_name" VARCHAR(200) NOT NULL,
            "contract_no" VARCHAR(128) NOT NULL,
            "equipment_name" VARCHAR(200) NOT NULL,
            "tax_inclusive_amount" DECIMAL(18,2) NOT NULL,
            "install_location" VARCHAR(500),
            "invoice_file_uuids" JSONB NOT NULL DEFAULT '[]',
            "acceptance_file_uuids" JSONB NOT NULL DEFAULT '[]',
            "acceptance_uploaded_at" TIMESTAMPTZ,
            "workflow_status" VARCHAR(32) NOT NULL DEFAULT 'draft',
            "submitted_at" TIMESTAMPTZ,
            "submitted_by_user_id" INT,
            "reporter_user_id" INT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_haoligo_fin_eq_payable_contract_alive"
            ON "haoligo_finance_equipment_payable" ("contract_id")
            WHERE "deleted_at" IS NULL;
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_payable_tenant"
            ON "haoligo_finance_equipment_payable" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_payable_supplier"
            ON "haoligo_finance_equipment_payable" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_payable_contract_no"
            ON "haoligo_finance_equipment_payable" ("contract_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_payable_status"
            ON "haoligo_finance_equipment_payable" ("workflow_status");
        COMMENT ON TABLE "haoligo_finance_equipment_payable" IS '好力GO - 设备应付款';

        CREATE TABLE IF NOT EXISTS "haoligo_finance_equipment_payable_payment" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "payable_id" INT NOT NULL REFERENCES "haoligo_finance_equipment_payable" ("id") ON DELETE CASCADE,
            "amount" DECIMAL(18,2) NOT NULL,
            "paid_at" TIMESTAMPTZ NOT NULL,
            "remark" TEXT,
            "created_by_user_id" INT
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_pay_payment_tenant"
            ON "haoligo_finance_equipment_payable_payment" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_pay_payment_payable"
            ON "haoligo_finance_equipment_payable_payment" ("payable_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_eq_pay_payment_paid_at"
            ON "haoligo_finance_equipment_payable_payment" ("paid_at");
        COMMENT ON TABLE "haoligo_finance_equipment_payable_payment" IS '好力GO - 设备应付款付款明细';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_finance_equipment_payable_payment";
        DROP TABLE IF EXISTS "haoligo_finance_equipment_payable";
        DROP TABLE IF EXISTS "haoligo_finance_equipment_contract";
    """
