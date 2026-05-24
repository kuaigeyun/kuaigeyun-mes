"""物料 main_code 唯一索引：允许多条属性 SKU 行共享同一主编码"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_master_data_materials_tenant_main_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_main_code"
        ON "apps_master_data_materials" ("tenant_id", "main_code")
        WHERE "deleted_at" IS NULL AND "variant_attributes" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_apps_master_data_materials_tenant_main_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_main_code"
        ON "apps_master_data_materials" ("tenant_id", "main_code")
        WHERE "deleted_at" IS NULL;
    """
