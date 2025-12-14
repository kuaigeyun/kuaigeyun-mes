"""
工厂数据模型迁移

创建车间、产线、工位表。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建车间表
        CREATE TABLE IF NOT EXISTS "seed_master_data_workshops" (
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
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_workshops_tenant_code" ON "seed_master_data_workshops" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workshops_tenant_id" ON "seed_master_data_workshops" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workshops_code" ON "seed_master_data_workshops" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workshops_uuid" ON "seed_master_data_workshops" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workshops_created_at" ON "seed_master_data_workshops" ("created_at");

        -- 创建产线表
        CREATE TABLE IF NOT EXISTS "seed_master_data_production_lines" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "workshop_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_production_lines_tenant_code" ON "seed_master_data_production_lines" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_production_lines_tenant_id" ON "seed_master_data_production_lines" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_production_lines_code" ON "seed_master_data_production_lines" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_production_lines_uuid" ON "seed_master_data_production_lines" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_production_lines_workshop_id" ON "seed_master_data_production_lines" ("workshop_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_production_lines_created_at" ON "seed_master_data_production_lines" ("created_at");
        -- 添加外键约束
        ALTER TABLE "seed_master_data_production_lines" ADD CONSTRAINT "fk_seed_master_data_production_lines_workshop_id" FOREIGN KEY ("workshop_id") REFERENCES "seed_master_data_workshops" ("id") ON DELETE RESTRICT;

        -- 创建工位表
        CREATE TABLE IF NOT EXISTS "seed_master_data_workstations" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "production_line_id" INT NOT NULL,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_seed_master_data_workstations_tenant_code" ON "seed_master_data_workstations" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workstations_tenant_id" ON "seed_master_data_workstations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workstations_code" ON "seed_master_data_workstations" ("code");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workstations_uuid" ON "seed_master_data_workstations" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workstations_production_line_id" ON "seed_master_data_workstations" ("production_line_id");
        CREATE INDEX IF NOT EXISTS "idx_seed_master_data_workstations_created_at" ON "seed_master_data_workstations" ("created_at");
        -- 添加外键约束
        ALTER TABLE "seed_master_data_workstations" ADD CONSTRAINT "fk_seed_master_data_workstations_production_line_id" FOREIGN KEY ("production_line_id") REFERENCES "seed_master_data_production_lines" ("id") ON DELETE RESTRICT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除工位表
        DROP TABLE IF EXISTS "seed_master_data_workstations" CASCADE;

        -- 删除产线表
        DROP TABLE IF EXISTS "seed_master_data_production_lines" CASCADE;

        -- 删除车间表
        DROP TABLE IF EXISTS "seed_master_data_workshops" CASCADE;
    """

