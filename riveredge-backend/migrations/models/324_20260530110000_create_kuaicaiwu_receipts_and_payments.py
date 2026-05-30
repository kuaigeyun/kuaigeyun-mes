"""
创建快财务收款单 / 付款单表 apps_kuaicaiwu_receipts、apps_kuaicaiwu_payments。

模型与 finance API 已存在，此前无 aerich 迁移，fresh deploy 执行 aerich upgrade 后表缺失。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_receipts" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_code" VARCHAR(50) NOT NULL,
    "customer_id" INT NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "settled_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unsettled_amount" DECIMAL(14,2) NOT NULL,
    "receipt_date" DATE NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "bank_account" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "created_by" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uq_apps_kuaicaiwu_receipts_receipt_code" UNIQUE ("receipt_code")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_receipts_uuid"
    ON "apps_kuaicaiwu_receipts" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_receipts_tenant_customer"
    ON "apps_kuaicaiwu_receipts" ("tenant_id", "customer_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_receipts_receipt_date"
    ON "apps_kuaicaiwu_receipts" ("receipt_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_receipts_status"
    ON "apps_kuaicaiwu_receipts" ("status");
COMMENT ON TABLE "apps_kuaicaiwu_receipts" IS '管理会计 - 收款单';

CREATE TABLE IF NOT EXISTS "apps_kuaicaiwu_payments" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "uuid" VARCHAR(36) NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_code" VARCHAR(50) NOT NULL,
    "supplier_id" INT NOT NULL,
    "supplier_name" VARCHAR(200) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "settled_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unsettled_amount" DECIMAL(14,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "bank_account" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "created_by" INT,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "uq_apps_kuaicaiwu_payments_payment_code" UNIQUE ("payment_code")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_payments_uuid"
    ON "apps_kuaicaiwu_payments" ("uuid");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_payments_tenant_supplier"
    ON "apps_kuaicaiwu_payments" ("tenant_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_payments_payment_date"
    ON "apps_kuaicaiwu_payments" ("payment_date");
CREATE INDEX IF NOT EXISTS "idx_apps_kuaicaiwu_payments_status"
    ON "apps_kuaicaiwu_payments" ("status");
COMMENT ON TABLE "apps_kuaicaiwu_payments" IS '管理会计 - 付款单';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP TABLE IF EXISTS "apps_kuaicaiwu_payments";
DROP TABLE IF EXISTS "apps_kuaicaiwu_receipts";
"""
