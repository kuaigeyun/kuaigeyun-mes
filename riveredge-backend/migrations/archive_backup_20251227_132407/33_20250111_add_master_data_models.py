from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建物料表
        CREATE TABLE IF NOT EXISTS "apps_master_data_materials" (
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
COMMENT ON TABLE "apps_master_data_materials" IS '物料表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_code" ON "apps_master_data_materials" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_id" ON "apps_master_data_materials" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_code" ON "apps_master_data_materials" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_uuid" ON "apps_master_data_materials" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_category" ON "apps_master_data_materials" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_created_at" ON "apps_master_data_materials" ("created_at");

        -- 创建客户表
        CREATE TABLE IF NOT EXISTS "apps_master_data_customers" (
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
COMMENT ON TABLE "apps_master_data_customers" IS '客户表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_code" ON "apps_master_data_customers" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_id" ON "apps_master_data_customers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_code" ON "apps_master_data_customers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_uuid" ON "apps_master_data_customers" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_category" ON "apps_master_data_customers" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_customers_created_at" ON "apps_master_data_customers" ("created_at");

        -- 创建供应商表
        CREATE TABLE IF NOT EXISTS "apps_master_data_suppliers" (
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
COMMENT ON TABLE "apps_master_data_suppliers" IS '供应商表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_code" ON "apps_master_data_suppliers" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_id" ON "apps_master_data_suppliers" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_code" ON "apps_master_data_suppliers" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_uuid" ON "apps_master_data_suppliers" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_category" ON "apps_master_data_suppliers" ("category");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_created_at" ON "apps_master_data_suppliers" ("created_at");

        -- 创建产品表
        CREATE TABLE IF NOT EXISTS "apps_master_data_products" (
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
COMMENT ON TABLE "apps_master_data_products" IS '产品表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_code" ON "apps_master_data_products" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_id" ON "apps_master_data_products" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_code" ON "apps_master_data_products" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_uuid" ON "apps_master_data_products" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_version" ON "apps_master_data_products" ("version");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_products_created_at" ON "apps_master_data_products" ("created_at");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除产品表
        DROP TABLE IF EXISTS "apps_master_data_products" CASCADE;

        -- 删除供应商表
        DROP TABLE IF EXISTS "apps_master_data_suppliers" CASCADE;

        -- 删除客户表
        DROP TABLE IF EXISTS "apps_master_data_customers" CASCADE;

        -- 删除物料表
        DROP TABLE IF EXISTS "apps_master_data_materials" CASCADE;"""


MODELS_STATE = (
    "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"
    "HIfg=="
)
