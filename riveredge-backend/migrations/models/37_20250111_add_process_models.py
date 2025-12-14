"""
工艺数据模型迁移

创建不良品、工序、工艺路线、作业程序（SOP）表。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建不良品表
        CREATE TABLE IF NOT EXISTS "seed_master_data_defect_types" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "category" VARCHAR(50),
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_defect_types_tenant_code" ON "seed_master_data_defect_types" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_defect_types_tenant_id" ON "seed_master_data_defect_types" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_defect_types_code" ON "seed_master_data_defect_types" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_defect_types_uuid" ON "seed_master_data_defect_types" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_defect_types_category" ON "seed_master_data_defect_types" ("category");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_defect_types_created_at" ON "seed_master_data_defect_types" ("created_at");

        -- 创建工序表
        CREATE TABLE IF NOT EXISTS "seed_master_data_operations" (
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
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_operations_tenant_code" ON "seed_master_data_operations" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_operations_tenant_id" ON "seed_master_data_operations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_operations_code" ON "seed_master_data_operations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_operations_uuid" ON "seed_master_data_operations" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_operations_created_at" ON "seed_master_data_operations" ("created_at");

        -- 创建工艺路线表
        CREATE TABLE IF NOT EXISTS "seed_master_data_process_routes" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "description" TEXT,
            "operation_sequence" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_process_routes_tenant_code" ON "seed_master_data_process_routes" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_process_routes_tenant_id" ON "seed_master_data_process_routes" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_process_routes_code" ON "seed_master_data_process_routes" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_process_routes_uuid" ON "seed_master_data_process_routes" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_process_routes_created_at" ON "seed_master_data_process_routes" ("created_at");

        -- 创建作业程序（SOP）表
        CREATE TABLE IF NOT EXISTS "seed_master_data_sop" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "operation_id" INT,
            "version" VARCHAR(20),
            "content" TEXT,
            "attachments" JSONB,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_sop_tenant_code" ON "seed_master_data_sop" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_tenant_id" ON "seed_master_data_sop" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_code" ON "seed_master_data_sop" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_uuid" ON "seed_master_data_sop" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_operation_id" ON "seed_master_data_sop" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_sop_created_at" ON "seed_master_data_sop" ("created_at");
        -- 添加外键约束
        ALTER TABLE "seed_master_data_sop" ADD CONSTRAINT "fk_seed_master_data_sop_operation_id" FOREIGN KEY ("operation_id") REFERENCES "seed_master_data_operations" ("id") ON DELETE RESTRICT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除作业程序（SOP）表
        DROP TABLE IF EXISTS "seed_master_data_sop" CASCADE;

        -- 删除工艺路线表
        DROP TABLE IF EXISTS "seed_master_data_process_routes" CASCADE;

        -- 删除工序表
        DROP TABLE IF EXISTS "seed_master_data_operations" CASCADE;

        -- 删除不良品表
        DROP TABLE IF EXISTS "seed_master_data_defect_types" CASCADE;
    """

