"""
物料批次增加 quality_status：历史在库批回填为 qualified；唯一键含质量态。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_material_batches"
    ADD COLUMN IF NOT EXISTS "quality_status" VARCHAR(20) NOT NULL DEFAULT 'qualified';

UPDATE "apps_master_data_material_batches"
SET "quality_status" = 'qualified'
WHERE "quality_status" IS NULL OR TRIM("quality_status") = '';

COMMENT ON COLUMN "apps_master_data_material_batches"."quality_status"
    IS '库存质量态（qualified=可售放行, pending_qc=待检, quarantine=隔离, unqualified=不合格未处置）';

DROP INDEX IF EXISTS "uidx_material_batch_ownership_wh";
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_material_batch_ownership_wh_qs"
    ON "apps_master_data_material_batches"
    ("tenant_id", "material_id", "batch_no", "ownership_type", "customer_id", "warehouse_id", "quality_status")
    WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_material_batch_quality_status"
    ON "apps_master_data_material_batches" ("tenant_id", "quality_status");
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "idx_material_batch_quality_status";
DROP INDEX IF EXISTS "uidx_material_batch_ownership_wh_qs";
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_material_batch_ownership_wh"
    ON "apps_master_data_material_batches"
    ("tenant_id", "material_id", "batch_no", "ownership_type", "customer_id", "warehouse_id")
    WHERE "deleted_at" IS NULL;
ALTER TABLE "apps_master_data_material_batches" DROP COLUMN IF EXISTS "quality_status";
"""
