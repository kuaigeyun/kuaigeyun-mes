"""
主数据管理模型迁移

创建物料、客户、供应商、产品表。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建物料表
        CREATE TABLE IF NOT EXISTS "seed_master_data_materials" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "specification" VARCHAR(500),
            "unit" VARCHAR(20) NOT NULL,
            "category" VARCHAR(50),
            "description" TEXT,
            "brand" VARCHAR(100),
            "model" VARCHAR(100),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_materials_tenant_code" ON "seed_master_data_materials" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_materials_tenant_id" ON "seed_master_data_materials" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_materials_code" ON "seed_master_data_materials" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_materials_uuid" ON "seed_master_data_materials" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_materials_category" ON "seed_master_data_materials" ("category");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_materials_created_at" ON "seed_master_data_materials" ("created_at");

        -- 创建客户表
        CREATE TABLE IF NOT EXISTS "seed_master_data_customers" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "short_name" VARCHAR(100),
            "contact_person" VARCHAR(100),
            "phone" VARCHAR(20),
            "email" VARCHAR(100),
            "address" TEXT,
            "category" VARCHAR(50),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_customers_tenant_code" ON "seed_master_data_customers" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_customers_tenant_id" ON "seed_master_data_customers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_customers_code" ON "seed_master_data_customers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_customers_uuid" ON "seed_master_data_customers" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_customers_category" ON "seed_master_data_customers" ("category");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_customers_created_at" ON "seed_master_data_customers" ("created_at");

        -- 创建供应商表
        CREATE TABLE IF NOT EXISTS "seed_master_data_suppliers" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "short_name" VARCHAR(100),
            "contact_person" VARCHAR(100),
            "phone" VARCHAR(20),
            "email" VARCHAR(100),
            "address" TEXT,
            "category" VARCHAR(50),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_suppliers_tenant_code" ON "seed_master_data_suppliers" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_suppliers_tenant_id" ON "seed_master_data_suppliers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_suppliers_code" ON "seed_master_data_suppliers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_suppliers_uuid" ON "seed_master_data_suppliers" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_suppliers_category" ON "seed_master_data_suppliers" ("category");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_suppliers_created_at" ON "seed_master_data_suppliers" ("created_at");

        -- 创建产品表
        CREATE TABLE IF NOT EXISTS "seed_master_data_products" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "specification" VARCHAR(500),
            "unit" VARCHAR(20) NOT NULL,
            "bom_data" JSONB,
            "version" VARCHAR(20),
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_products_tenant_code" ON "seed_master_data_products" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_products_tenant_id" ON "seed_master_data_products" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_products_code" ON "seed_master_data_products" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_products_uuid" ON "seed_master_data_products" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_products_version" ON "seed_master_data_products" ("version");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_products_created_at" ON "seed_master_data_products" ("created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除产品表
        DROP TABLE IF EXISTS "seed_master_data_products" CASCADE;

        -- 删除供应商表
        DROP TABLE IF EXISTS "seed_master_data_suppliers" CASCADE;

        -- 删除客户表
        DROP TABLE IF EXISTS "seed_master_data_customers" CASCADE;

        -- 删除物料表
        DROP TABLE IF EXISTS "seed_master_data_materials" CASCADE;
    """

