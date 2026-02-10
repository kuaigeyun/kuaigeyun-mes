"""
添加物料变体组合唯一性索引

确保同一主编码下，变体属性组合唯一（防止重复变体）。

Author: Luigi Lu
Date: 2026-01-09
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加物料变体组合唯一性索引
    """
    return """
        -- ============================================
        -- 1. 创建变体组合唯一性索引
        -- ============================================
        -- 使用表达式索引，确保同一主编码下，变体属性组合唯一
        -- 注意：PostgreSQL的JSONB字段比较是精确匹配，需要确保属性顺序一致
        -- 使用 jsonb_object_keys 和排序来创建稳定的唯一性约束
        
        -- 方案1：使用表达式索引（推荐）
        -- 创建一个基于排序后的JSONB键值对的唯一性索引
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_material_variant_combination" 
        ON "apps_master_data_materials" (
            "tenant_id", 
            "main_code", 
            -- 使用 jsonb_strip_nulls 和 jsonb_object_keys 创建稳定的键值对
            -- 但PostgreSQL不支持在唯一索引中直接使用复杂的JSONB表达式
            -- 因此使用 variant_attributes 字段本身（需要确保应用层保证JSON键顺序一致）
            "variant_attributes"
        )
        WHERE "variant_managed" = true 
          AND "variant_attributes" IS NOT NULL
          AND "deleted_at" IS NULL;
        
        COMMENT ON INDEX "uid_material_variant_combination" IS '物料变体组合唯一性索引：确保同一主编码下，变体属性组合唯一';
        
        -- ============================================
        -- 2. 创建变体查询优化索引
        -- ============================================
        -- 用于快速查询主物料的所有变体
        CREATE INDEX IF NOT EXISTS "idx_material_variants_by_main_code" 
        ON "apps_master_data_materials" (
            "tenant_id", 
            "main_code", 
            "variant_managed"
        )
        WHERE "variant_managed" = true 
          AND "variant_attributes" IS NOT NULL
          AND "deleted_at" IS NULL;
        
        COMMENT ON INDEX "idx_material_variants_by_main_code" IS '变体物料查询索引：用于快速查询主物料的所有变体';
        
        -- ============================================
        -- 3. 创建主物料查询索引
        -- ============================================
        -- 用于快速查询主物料（variant_managed=true, variant_attributes=null）
        CREATE INDEX IF NOT EXISTS "idx_material_master_by_main_code" 
        ON "apps_master_data_materials" (
            "tenant_id", 
            "main_code", 
            "variant_managed"
        )
        WHERE "variant_managed" = true 
          AND "variant_attributes" IS NULL
          AND "deleted_at" IS NULL;
        
        COMMENT ON INDEX "idx_material_master_by_main_code" IS '主物料查询索引：用于快速查询主物料';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除添加的索引
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_material_master_by_main_code";
        DROP INDEX IF EXISTS "idx_material_variants_by_main_code";
        DROP INDEX IF EXISTS "uid_material_variant_combination";
    """
