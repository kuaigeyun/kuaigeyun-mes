"""
添加物料默认值字段和编码别名外部实体字段

包含：
1. apps_master_data_materials 表添加 defaults 字段（JSONB）
2. apps_master_data_material_code_aliases 表添加 external_entity_type 和 external_entity_id 字段

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加物料默认值字段和编码别名外部实体字段
    """
    return """
        -- ============================================
        -- 1. 为物料表添加默认值字段
        -- ============================================
        ALTER TABLE "apps_master_data_materials" 
        ADD COLUMN IF NOT EXISTS "defaults" JSONB;
        
        COMMENT ON COLUMN "apps_master_data_materials"."defaults" IS '默认值设置（JSON格式），包含财务、采购、销售、库存、生产的默认值';
        
        -- ============================================
        -- 2. 为编码别名表添加外部实体字段
        -- ============================================
        ALTER TABLE "apps_master_data_material_code_aliases" 
        ADD COLUMN IF NOT EXISTS "external_entity_type" VARCHAR(20);
        
        ALTER TABLE "apps_master_data_material_code_aliases" 
        ADD COLUMN IF NOT EXISTS "external_entity_id" INT;
        
        COMMENT ON COLUMN "apps_master_data_material_code_aliases"."external_entity_type" IS '外部实体类型（customer/supplier，用于客户编码和供应商编码）';
        COMMENT ON COLUMN "apps_master_data_material_code_aliases"."external_entity_id" IS '外部实体ID（客户ID或供应商ID）';
        
        -- ============================================
        -- 3. 创建索引（用于外部实体查询）
        -- ============================================
        CREATE INDEX IF NOT EXISTS "idx_material_code_alias_external_entity" 
        ON "apps_master_data_material_code_aliases" ("external_entity_type", "external_entity_id") 
        WHERE "external_entity_type" IS NOT NULL AND "external_entity_id" IS NOT NULL;
        
        -- ============================================
        -- 4. 更新唯一约束（考虑外部实体）
        -- ============================================
        -- 注意：原有的唯一约束 (tenant_id, code_type, code) 仍然有效
        -- 对于客户编码和供应商编码，需要同时考虑 external_entity_id
        -- 这里不修改唯一约束，而是在应用层处理唯一性验证
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除添加的字段
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_material_code_alias_external_entity";
        
        -- 删除编码别名表的外部实体字段
        ALTER TABLE "apps_master_data_material_code_aliases" 
        DROP COLUMN IF EXISTS "external_entity_id";
        
        ALTER TABLE "apps_master_data_material_code_aliases" 
        DROP COLUMN IF EXISTS "external_entity_type";
        
        -- 删除物料表的默认值字段
        ALTER TABLE "apps_master_data_materials" 
        DROP COLUMN IF EXISTS "defaults";
    """
