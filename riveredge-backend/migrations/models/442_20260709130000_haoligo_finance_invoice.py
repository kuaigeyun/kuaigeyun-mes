"""
好力 GO — 财务发票与材料验收单。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "haoligo_finance_invoice" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "supplier_id" INT NOT NULL REFERENCES "haoligo_finance_supplier" ("id") ON DELETE RESTRICT,
            "invoice_no" VARCHAR(64) NOT NULL,
            "invoice_code" VARCHAR(64),
            "invoice_date" DATE,
            "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "qr_raw_text" TEXT,
            "source_file_uuid" VARCHAR(36),
            "parsed_snapshot" JSONB,
            "status" VARCHAR(16) NOT NULL DEFAULT '待核对',
            "reject_reason" TEXT,
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_tenant" ON "haoligo_finance_invoice" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_supplier" ON "haoligo_finance_invoice" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_no" ON "haoligo_finance_invoice" ("invoice_no");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_status" ON "haoligo_finance_invoice" ("status");

        CREATE TABLE IF NOT EXISTS "haoligo_finance_invoice_line" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "invoice_id" INT NOT NULL REFERENCES "haoligo_finance_invoice" ("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "material_code" VARCHAR(64) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "spec" VARCHAR(200),
            "unit" VARCHAR(32),
            "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "invoice_unit_price" DECIMAL(18,4) NOT NULL,
            "tax_amount" DECIMAL(18,2),
            "system_unit_price" DECIMAL(18,4),
            "price_diff_amount" DECIMAL(18,4),
            "price_diff_ratio" DECIMAL(18,4),
            "line_status" VARCHAR(16) NOT NULL DEFAULT '缺失单价',
            "supplier_price_id" INT,
            "reject_reason" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_line_tenant" ON "haoligo_finance_invoice_line" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_line_inv" ON "haoligo_finance_invoice_line" ("invoice_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_inv_line_mat" ON "haoligo_finance_invoice_line" ("material_code");

        CREATE TABLE IF NOT EXISTS "haoligo_finance_material_acceptance" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "sheet_no" VARCHAR(64) NOT NULL,
            "supplier_id" INT NOT NULL REFERENCES "haoligo_finance_supplier" ("id") ON DELETE RESTRICT,
            "acceptance_date" DATE,
            "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(16) NOT NULL DEFAULT '草稿',
            "reject_reason" TEXT,
            "pdf_file_uuid" VARCHAR(36),
            "remark" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_haoligo_fin_acc_tenant_sheet" UNIQUE ("tenant_id", "sheet_no")
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_tenant" ON "haoligo_finance_material_acceptance" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_supplier" ON "haoligo_finance_material_acceptance" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_status" ON "haoligo_finance_material_acceptance" ("status");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_date" ON "haoligo_finance_material_acceptance" ("acceptance_date");

        CREATE TABLE IF NOT EXISTS "haoligo_finance_material_acceptance_line" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "acceptance_id" INT NOT NULL REFERENCES "haoligo_finance_material_acceptance" ("id") ON DELETE CASCADE,
            "line_no" INT NOT NULL DEFAULT 1,
            "material_code" VARCHAR(64) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "spec" VARCHAR(200),
            "unit" VARCHAR(32),
            "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "unit_price" DECIMAL(18,4) NOT NULL,
            "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "source_invoice_line_ids" JSONB,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_line_tenant" ON "haoligo_finance_material_acceptance_line" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_line_acc" ON "haoligo_finance_material_acceptance_line" ("acceptance_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_line_mat" ON "haoligo_finance_material_acceptance_line" ("material_code");

        CREATE TABLE IF NOT EXISTS "haoligo_finance_acceptance_invoice" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "acceptance_id" INT NOT NULL REFERENCES "haoligo_finance_material_acceptance" ("id") ON DELETE CASCADE,
            "invoice_id" INT NOT NULL REFERENCES "haoligo_finance_invoice" ("id") ON DELETE RESTRICT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_haoligo_fin_acc_inv" UNIQUE ("tenant_id", "acceptance_id", "invoice_id")
        );
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_inv_tenant" ON "haoligo_finance_acceptance_invoice" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_inv_acc" ON "haoligo_finance_acceptance_invoice" ("acceptance_id");
        CREATE INDEX IF NOT EXISTS "idx_haoligo_fin_acc_inv_inv" ON "haoligo_finance_acceptance_invoice" ("invoice_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "haoligo_finance_acceptance_invoice" CASCADE;
        DROP TABLE IF EXISTS "haoligo_finance_material_acceptance_line" CASCADE;
        DROP TABLE IF EXISTS "haoligo_finance_material_acceptance" CASCADE;
        DROP TABLE IF EXISTS "haoligo_finance_invoice_line" CASCADE;
        DROP TABLE IF EXISTS "haoligo_finance_invoice" CASCADE;
    """
