"""
创建物料编码映射表

创建 apps_master_data_material_code_mappings 表，用于外部编码映射到内部编码。

Author: Auto (AI Assistant)
Date: 2026-01-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：创建物料编码映射表
    """
    return """
        -- ============================================
        -- 创建物料编码映射表
        -- ============================================
        
        CREATE TABLE IF NOT EXISTS "apps_master_data_material_code_mappings" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "material_id" INT NOT NULL,
            "internal_code" VARCHAR(50) NOT NULL,
            "external_code" VARCHAR(100) NOT NULL,
            "external_system" VARCHAR(50) NOT NULL,
            "description" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "fk_apps_master_data_material_code_mappings_material_id" 
                FOREIGN KEY ("material_id") 
                REFERENCES "apps_master_data_materials" ("id") 
                ON DELETE CASCADE,
            CONSTRAINT "uid_apps_master_data_material_code_mappings_tenant_external" 
                UNIQUE ("tenant_id", "external_system", "external_code")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_tenant_id" 
            ON "apps_master_data_material_code_mappings" ("tenant_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_material_id" 
            ON "apps_master_data_material_code_mappings" ("material_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_internal_code" 
            ON "apps_master_data_material_code_mappings" ("internal_code");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_external_code" 
            ON "apps_master_data_material_code_mappings" ("external_code");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_external_system" 
            ON "apps_master_data_material_code_mappings" ("external_system");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_is_active" 
            ON "apps_master_data_material_code_mappings" ("is_active");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_material_code_mappings_uuid" 
            ON "apps_master_data_material_code_mappings" ("uuid");
        
        -- 添加字段注释
        COMMENT ON TABLE "apps_master_data_material_code_mappings" IS '物料编码映射表（外部编码映射到内部编码）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."tenant_id" IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."id" IS '映射ID（主键，自增ID，内部使用）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."material_id" IS '物料ID（外键，关联内部物料）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."internal_code" IS '内部编码（物料编码）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."external_code" IS '外部编码（外部系统的编码）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."external_system" IS '外部系统名称（如：ERP、WMS、MES等）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."description" IS '描述（可选）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."is_active" IS '是否启用（默认：true）';
        COMMENT ON COLUMN "apps_master_data_material_code_mappings"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除物料编码映射表
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_uuid";
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_is_active";
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_external_system";
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_external_code";
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_internal_code";
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_material_id";
        DROP INDEX IF EXISTS "idx_apps_master_data_material_code_mappings_tenant_id";
        
        -- 删除表
        DROP TABLE IF EXISTS "apps_master_data_material_code_mappings";
    """
