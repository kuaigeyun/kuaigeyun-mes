"""
代工来料整合：登记明细表、工单/订单关联、批次归属、来料检验来源扩展
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 代工来料单头扩展
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "sales_order_id" INT;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "sales_order_code" VARCHAR(50);
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "work_order_id" INT;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "work_order_code" VARCHAR(50);
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100);
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "total_quantity" DECIMAL(12,2) DEFAULT 0;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "processed_by" INT;
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" ADD COLUMN IF NOT EXISTS "processed_by_name" VARCHAR(100);

-- 代工来料明细
CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_customer_material_registration_items" (
    "id" SERIAL PRIMARY KEY,
    "uuid" UUID NOT NULL,
    "tenant_id" INT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registration_id" INT NOT NULL,
    "material_id" INT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "material_spec" VARCHAR(200),
    "material_unit" VARCHAR(20),
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "barcode" VARCHAR(500),
    "barcode_type" VARCHAR(10) DEFAULT '1d',
    "mapping_rule_id" INT,
    "batch_number" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_cmri_tenant" ON "apps_kuaizhizao_customer_material_registration_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_cmri_registration" ON "apps_kuaizhizao_customer_material_registration_items" ("registration_id");
CREATE INDEX IF NOT EXISTS "idx_cmri_material" ON "apps_kuaizhizao_customer_material_registration_items" ("material_id");

-- 批次归属（客供/自购）
ALTER TABLE "apps_master_data_material_batches" ADD COLUMN IF NOT EXISTS "ownership_type" VARCHAR(20) NOT NULL DEFAULT 'company_owned';
ALTER TABLE "apps_master_data_material_batches" ADD COLUMN IF NOT EXISTS "customer_id" INT NOT NULL DEFAULT 0;
ALTER TABLE "apps_master_data_material_batches" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(200);
ALTER TABLE "apps_master_data_material_batches" ADD COLUMN IF NOT EXISTS "source_doc_id" INT;
ALTER TABLE "apps_master_data_material_batches" ADD COLUMN IF NOT EXISTS "source_doc_code" VARCHAR(50);

ALTER TABLE "apps_master_data_material_batches" DROP CONSTRAINT IF EXISTS "apps_master_data_material_batches_tenant_id_material_id_batch_no_key";
DROP INDEX IF EXISTS "apps_master_data_material_batches_tenant_id_material_id_batch_no_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_material_batch_ownership"
    ON "apps_master_data_material_batches" ("tenant_id", "material_id", "batch_no", "ownership_type", "customer_id")
    WHERE "deleted_at" IS NULL;

-- 来料检验支持代工来料来源
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(30) NOT NULL DEFAULT 'purchase_receipt';
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ADD COLUMN IF NOT EXISTS "customer_material_registration_id" INT;
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ADD COLUMN IF NOT EXISTS "customer_material_registration_code" VARCHAR(50);
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ADD COLUMN IF NOT EXISTS "customer_id" INT;
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(200);
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ALTER COLUMN "purchase_receipt_id" DROP NOT NULL;
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ALTER COLUMN "purchase_receipt_code" DROP NOT NULL;
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ALTER COLUMN "supplier_id" DROP NOT NULL;
ALTER TABLE "apps_kuaizhizao_incoming_inspections" ALTER COLUMN "supplier_name" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_iqc_cm_registration" ON "apps_kuaizhizao_incoming_inspections" ("customer_material_registration_id");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_iqc_cm_registration";
ALTER TABLE "apps_kuaizhizao_incoming_inspections" DROP COLUMN IF EXISTS "customer_name";
ALTER TABLE "apps_kuaizhizao_incoming_inspections" DROP COLUMN IF EXISTS "customer_id";
ALTER TABLE "apps_kuaizhizao_incoming_inspections" DROP COLUMN IF EXISTS "customer_material_registration_code";
ALTER TABLE "apps_kuaizhizao_incoming_inspections" DROP COLUMN IF EXISTS "customer_material_registration_id";
ALTER TABLE "apps_kuaizhizao_incoming_inspections" DROP COLUMN IF EXISTS "source_type";

DROP INDEX IF EXISTS "uidx_material_batch_ownership";
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "source_doc_code";
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "source_doc_id";
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "customer_name";
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "customer_id";
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "ownership_type";

DROP TABLE IF EXISTS "apps_kuaizhizao_customer_material_registration_items";

ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "processed_by_name";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "processed_by";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "total_quantity";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "batch_number";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "work_order_code";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "work_order_id";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "sales_order_code";
ALTER TABLE "apps_kuaizhizao_customer_material_registrations" DROP COLUMN IF EXISTS "sales_order_id";
"""
