"""
添加变体属性定义相关模型

包含：
1. core_material_variant_attribute_definitions - 变体属性定义表
2. core_material_variant_attribute_history - 变体属性定义版本历史表

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加变体属性定义相关模型
    """
    return """
        -- ============================================
        -- 1. 创建变体属性定义表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_variant_attribute_definitions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "attribute_name" VARCHAR(50) NOT NULL,
            "attribute_type" VARCHAR(20) NOT NULL,
            "display_name" VARCHAR(100) NOT NULL,
            "description" TEXT,
            "is_required" BOOL NOT NULL DEFAULT false,
            "display_order" INT NOT NULL DEFAULT 0,
            "enum_values" JSONB,
            "validation_rules" JSONB,
            "default_value" VARCHAR(200),
            "dependencies" JSONB,
            "is_active" BOOL NOT NULL DEFAULT true,
            "version" INT NOT NULL DEFAULT 1,
            "created_by" INT,
            "updated_by" INT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_variant_attr_tenant_name" UNIQUE ("tenant_id", "attribute_name")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__d4e5f6" ON "core_material_variant_attribute_definitions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_attrib_e7f8g9" ON "core_material_variant_attribute_definitions" ("attribute_type");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_is_act_h0i1j2" ON "core_material_variant_attribute_definitions" ("is_active");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_displ_k3l4m5" ON "core_material_variant_attribute_definitions" ("display_order");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_created_n6o7p8" ON "core_material_variant_attribute_definitions" ("created_at");
        
        -- 添加表注释
        COMMENT ON TABLE "core_material_variant_attribute_definitions" IS '变体属性定义表，用于定义物料变体的属性配置';
        COMMENT ON COLUMN "core_material_variant_attribute_definitions"."attribute_name" IS '属性名称（唯一标识，如：颜色、尺寸）';
        COMMENT ON COLUMN "core_material_variant_attribute_definitions"."attribute_type" IS '属性类型（enum/text/number/date/boolean）';
        COMMENT ON COLUMN "core_material_variant_attribute_definitions"."display_name" IS '显示名称（如：产品颜色）';
        COMMENT ON COLUMN "core_material_variant_attribute_definitions"."enum_values" IS '枚举值列表（JSON数组，如果type=enum）';
        COMMENT ON COLUMN "core_material_variant_attribute_definitions"."validation_rules" IS '验证规则（JSON格式，如：{"max_length": 50, "min": 0, "max": 100}）';
        COMMENT ON COLUMN "core_material_variant_attribute_definitions"."dependencies" IS '依赖关系（JSON格式，如：{"depends_on": "颜色", "rules": {...}}）';
        
        -- ============================================
        -- 2. 创建变体属性定义版本历史表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "core_material_variant_attribute_history" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "attribute_definition_id" INT NOT NULL,
            "version" INT NOT NULL,
            "attribute_config" JSONB NOT NULL,
            "change_description" TEXT,
            "changed_by" INT,
            "changed_at" TIMESTAMPTZ,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_core_variant_attr_hist_def_version" UNIQUE ("attribute_definition_id", "version")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_core_materia_tenant__t2u3v4" ON "core_material_variant_attribute_history" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_attrib_w5x6y7" ON "core_material_variant_attribute_history" ("attribute_definition_id");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_version_z8a9b0" ON "core_material_variant_attribute_history" ("version");
        CREATE INDEX IF NOT EXISTS "idx_core_materia_chang_c1d2e3" ON "core_material_variant_attribute_history" ("changed_at");
        
        -- 添加表注释
        COMMENT ON TABLE "core_material_variant_attribute_history" IS '变体属性定义版本历史表，用于记录属性定义的版本变更历史';
        COMMENT ON COLUMN "core_material_variant_attribute_history"."attribute_definition_id" IS '关联的属性定义ID';
        COMMENT ON COLUMN "core_material_variant_attribute_history"."version" IS '版本号';
        COMMENT ON COLUMN "core_material_variant_attribute_history"."attribute_config" IS '完整的属性配置（JSON格式）';
        COMMENT ON COLUMN "core_material_variant_attribute_history"."change_description" IS '变更说明';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除变体属性定义相关模型
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_core_materia_chang_c1d2e3";
        DROP INDEX IF EXISTS "idx_core_materia_version_z8a9b0";
        DROP INDEX IF EXISTS "idx_core_materia_attrib_w5x6y7";
        DROP INDEX IF EXISTS "idx_core_materia_tenant__t2u3v4";
        
        -- 删除表
        DROP TABLE IF EXISTS "core_material_variant_attribute_history";
        
        -- 删除索引
        DROP INDEX IF EXISTS "idx_core_materia_created_n6o7p8";
        DROP INDEX IF EXISTS "idx_core_materia_displ_k3l4m5";
        DROP INDEX IF EXISTS "idx_core_materia_is_act_h0i1j2";
        DROP INDEX IF EXISTS "idx_core_materia_attrib_e7f8g9";
        DROP INDEX IF EXISTS "idx_core_materia_tenant__d4e5f6";
        
        -- 删除表
        DROP TABLE IF EXISTS "core_material_variant_attribute_definitions";
    """
