"""
修复迁移 371 未删除的旧批次唯一约束。

迁移 32 创建的约束名为 uid_apps_master_batch_tenant_material_batch；
371 误删 apps_master_data_material_batches_tenant_id_material_id_batch_no_key，
导致 (tenant_id, material_id, batch_no) 仍全局唯一，自购与客供无法共用 DEFAULT 批号。

本迁移删除旧约束/索引，保留 uidx_material_batch_ownership（按归属隔离）。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_material_batches"
    DROP CONSTRAINT IF EXISTS "uid_apps_master_batch_tenant_material_batch";
ALTER TABLE "apps_master_data_material_batches"
    DROP CONSTRAINT IF EXISTS "apps_master_data_material_batches_tenant_id_material_id_batch_no_key";
DROP INDEX IF EXISTS "uid_apps_master_batch_tenant_material_batch";
DROP INDEX IF EXISTS "apps_master_data_material_batches_tenant_id_material_id_batch_no_key";
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_material_batch_ownership"
    ON "apps_master_data_material_batches" ("tenant_id", "material_id", "batch_no", "ownership_type", "customer_id")
    WHERE "deleted_at" IS NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
DROP INDEX IF EXISTS "uidx_material_batch_ownership";
CREATE UNIQUE INDEX IF NOT EXISTS "uid_apps_master_batch_tenant_material_batch"
    ON "apps_master_data_material_batches" ("tenant_id", "material_id", "batch_no");
"""
