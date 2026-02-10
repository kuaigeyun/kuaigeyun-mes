"""
添加BOM优化字段

根据《工艺路线和标准作业流程优化设计规范.md》，为BOM表添加优化字段。

包含：
1. waste_rate - 损耗率（百分比）
2. is_required - 是否必选
3. level - 层级深度
4. path - 层级路径

Author: Auto (AI Assistant)
Date: 2026-01-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加BOM优化字段
    """
    return """
        -- ============================================
        -- 添加BOM优化字段
        -- ============================================
        
        -- 添加损耗率字段
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "waste_rate" DECIMAL(5, 2) NOT NULL DEFAULT 0.00;
        
        -- 添加是否必选字段
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN NOT NULL DEFAULT TRUE;
        
        -- 添加层级深度字段
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "level" INT NOT NULL DEFAULT 0;
        
        -- 添加层级路径字段
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        ADD COLUMN IF NOT EXISTS "path" VARCHAR(500);
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_level" ON "apps_master_data_bom" ("level");
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_bom_path" ON "apps_master_data_bom" ("path");
        
        -- 添加字段注释
        COMMENT ON COLUMN "apps_master_data_bom"."waste_rate" IS '损耗率（百分比，如：5.00表示5%，用于计算实际用料数量）';
        COMMENT ON COLUMN "apps_master_data_bom"."is_required" IS '是否必选（是/否，默认：是）';
        COMMENT ON COLUMN "apps_master_data_bom"."level" IS '层级深度（0为顶层，用于多层级BOM展开）';
        COMMENT ON COLUMN "apps_master_data_bom"."path" IS '层级路径（如：1/2/3，用于快速查询和排序）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除BOM优化字段
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_master_data_bom_path";
        DROP INDEX IF EXISTS "idx_apps_master_data_bom_level";
        
        -- 删除字段
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        DROP COLUMN IF EXISTS "path";
        
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        DROP COLUMN IF EXISTS "level";
        
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        DROP COLUMN IF EXISTS "is_required";
        
        ALTER TABLE IF EXISTS "apps_master_data_bom" 
        DROP COLUMN IF EXISTS "waste_rate";
    """
