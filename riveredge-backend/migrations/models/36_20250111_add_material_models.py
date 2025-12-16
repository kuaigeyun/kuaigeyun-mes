"""
物料数据模型迁移

创建物料分组、物料、BOM表。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建物料分组表
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_groups" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "parent_id" INT,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_material_groups" IS '物料组表';
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_code" ON "apps_master_data_material_groups" ("tenant_id", "code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_id" ON "apps_master_data_material_groups" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_code" ON "apps_master_data_material_groups" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_uuid" ON "apps_master_data_material_groups" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_parent_id" ON "apps_master_data_material_groups" ("parent_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_created_at" ON "apps_master_data_material_groups" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_material_groups" ADD CONSTRAINT "fk_apps_master_data_material_groups_parent_id" FOREIGN KEY ("parent_id") REFERENCES "apps_master_data_material_groups" ("id") ON DELETE RESTRICT;

        -- 删除旧的物料表（如果存在）
        DROP TABLE IF EXISTS "apps_master_data_materials" CASCADE;

        -- 创建物料表
        CREATE TABLE IF NOT EXISTS "apps_master_data_materials" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200) NOT NULL,
            "group_id" INT,
            "specification" VARCHAR(500),
            "base_unit" VARCHAR(20) NOT NULL,
            "units" JSONB,
            "batch_managed" BOOL NOT NULL DEFAULT False,
            "variant_managed" BOOL NOT NULL DEFAULT False,
            "variant_attributes" JSONB,
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
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_group_id" ON "apps_master_data_materials" ("group_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_created_at" ON "apps_master_data_materials" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_materials" ADD CONSTRAINT "fk_apps_master_data_materials_group_id" FOREIGN KEY ("group_id") REFERENCES "apps_master_data_material_groups" ("id") ON DELETE RESTRICT;

        -- 创建BOM表
        CREATE TABLE IF NOT EXISTS "apps_master_data_bom" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT NOT NULL,
            "material_id" INT NOT NULL,
            "component_id" INT NOT NULL,
            "quantity" DECIMAL(18, 4) NOT NULL,
            "unit" VARCHAR(20) NOT NULL,
            "is_alternative" BOOL NOT NULL DEFAULT False,
            "alternative_group_id" INT,
            "priority" INT NOT NULL DEFAULT 0,
            "description" TEXT,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "apps_master_data_bom" IS 'BOM（物料清单）表';
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_tenant_id" ON "apps_master_data_bom" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_material_id" ON "apps_master_data_bom" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_component_id" ON "apps_master_data_bom" ("component_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_uuid" ON "apps_master_data_bom" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_alternative_group_id" ON "apps_master_data_bom" ("alternative_group_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_created_at" ON "apps_master_data_bom" ("created_at");
        -- 添加外键约束
        ALTER TABLE "apps_master_data_bom" ADD CONSTRAINT "fk_apps_master_data_bom_material_id" FOREIGN KEY ("material_id") REFERENCES "apps_master_data_materials" ("id") ON DELETE RESTRICT;
        ALTER TABLE "apps_master_data_bom" ADD CONSTRAINT "fk_apps_master_data_bom_component_id" FOREIGN KEY ("component_id") REFERENCES "apps_master_data_materials" ("id") ON DELETE RESTRICT;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除BOM表
        DROP TABLE IF EXISTS "apps_master_data_bom" CASCADE;

        -- 删除物料表
        DROP TABLE IF EXISTS "apps_master_data_materials" CASCADE;

        -- 删除物料分组表
        DROP TABLE IF EXISTS "apps_master_data_material_groups" CASCADE;
    """

