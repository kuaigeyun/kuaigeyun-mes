"""
仓库数据模型迁移

创建仓库、库区、库位表。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建仓库表
        CREATE TABLE IF NOT EXISTS "seed_master_data_warehouses" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_warehouses_tenant_code" ON "seed_master_data_warehouses" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_warehouses_tenant_id" ON "seed_master_data_warehouses" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_warehouses_code" ON "seed_master_data_warehouses" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_warehouses_uuid" ON "seed_master_data_warehouses" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_warehouses_created_at" ON "seed_master_data_warehouses" ("created_at");

        -- 创建库区表
        CREATE TABLE IF NOT EXISTS "seed_master_data_storage_areas" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "warehouse_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_storage_areas_tenant_code" ON "seed_master_data_storage_areas" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_areas_tenant_id" ON "seed_master_data_storage_areas" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_areas_code" ON "seed_master_data_storage_areas" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_areas_uuid" ON "seed_master_data_storage_areas" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_areas_warehouse_id" ON "seed_master_data_storage_areas" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_areas_created_at" ON "seed_master_data_storage_areas" ("created_at");
        -- 添加外键约束
        ALTER TABLE "seed_master_data_storage_areas" ADD CONSTRAINT "fk_seed_master_data_storage_areas_warehouse_id" FOREIGN KEY ("warehouse_id") REFERENCES "seed_master_data_warehouses" ("id") ON DELETE RESTRICT;

        -- 创建库位表
        CREATE TABLE IF NOT EXISTS "seed_master_data_storage_locations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "storage_area_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_storage_locations_tenant_code" ON "seed_master_data_storage_locations" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_locations_tenant_id" ON "seed_master_data_storage_locations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_locations_code" ON "seed_master_data_storage_locations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_locations_uuid" ON "seed_master_data_storage_locations" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_locations_storage_area_id" ON "seed_master_data_storage_locations" ("storage_area_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_storage_locations_created_at" ON "seed_master_data_storage_locations" ("created_at");
        -- 添加外键约束
        ALTER TABLE "seed_master_data_storage_locations" ADD CONSTRAINT "fk_seed_master_data_storage_locations_storage_area_id" FOREIGN KEY ("storage_area_id") REFERENCES "seed_master_data_storage_areas" ("id") ON DELETE RESTRICT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除库位表
        DROP TABLE IF EXISTS "seed_master_data_storage_locations" CASCADE;

        -- 删除库区表
        DROP TABLE IF EXISTS "seed_master_data_storage_areas" CASCADE;

        -- 删除仓库表
        DROP TABLE IF EXISTS "seed_master_data_warehouses" CASCADE;
    """

