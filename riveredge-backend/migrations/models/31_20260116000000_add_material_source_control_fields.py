"""
添加物料来源控制字段迁移

为Material和DemandComputationItem模型添加物料来源控制相关字段。

变更内容：
- Material表添加source_type和source_config字段（物料来源类型和配置）
- DemandComputationItem表添加物料来源相关字段（material_source_type、material_source_config、source_validation_passed、source_validation_errors）
- 添加source_type索引以提升查询性能

根据《☆ 用户使用全场景推演.md》的设计，实现物料来源控制功能。

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加物料来源控制字段
    """
    return """
        -- ============================================
        -- Material表：添加物料来源控制字段
        -- ============================================
        
        -- 添加source_type字段（物料来源类型）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'apps_master_data_materials' 
                AND column_name = 'source_type'
            ) THEN
                ALTER TABLE "apps_master_data_materials" 
                ADD COLUMN "source_type" VARCHAR(20) NULL;
            END IF;
        END $$;
        
        COMMENT ON COLUMN "apps_master_data_materials"."source_type" IS '物料来源类型（Make/Buy/Phantom/Outsource/Configure）：Make(自制件)、Buy(采购件)、Phantom(虚拟件)、Outsource(委外件)、Configure(配置件)';
        
        -- 添加source_config字段（物料来源相关配置，JSON格式）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'apps_master_data_materials' 
                AND column_name = 'source_config'
            ) THEN
                ALTER TABLE "apps_master_data_materials" 
                ADD COLUMN "source_config" JSONB NULL;
            END IF;
        END $$;
        
        COMMENT ON COLUMN "apps_master_data_materials"."source_config" IS '物料来源相关配置（JSON格式），包含：BOM、工艺路线、供应商、委外供应商、委外工序、变体属性等';
        
        -- 添加source_type索引（用于快速查询和筛选）
        CREATE INDEX IF NOT EXISTS "idx_apps_master_data_materials_source_type" 
        ON "apps_master_data_materials" USING btree ("source_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST);
        
        -- ============================================
        -- DemandComputationItem表：添加物料来源相关字段
        -- ============================================
        
        -- 检查表是否存在，如果存在则添加字段
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'apps_kuaizhizao_demand_computation_items'
            ) THEN
                -- 添加material_source_type字段（物料来源类型）
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'apps_kuaizhizao_demand_computation_items' 
                    AND column_name = 'material_source_type'
                ) THEN
                    ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
                    ADD COLUMN "material_source_type" VARCHAR(20) NULL;
                    COMMENT ON COLUMN "apps_kuaizhizao_demand_computation_items"."material_source_type" IS '物料来源类型（Make/Buy/Phantom/Outsource/Configure）';
                END IF;
                
                -- 添加material_source_config字段（物料来源配置信息）
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'apps_kuaizhizao_demand_computation_items' 
                    AND column_name = 'material_source_config'
                ) THEN
                    ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
                    ADD COLUMN "material_source_config" JSONB NULL;
                    COMMENT ON COLUMN "apps_kuaizhizao_demand_computation_items"."material_source_config" IS '物料来源配置信息（JSON格式）';
                END IF;
                
                -- 添加source_validation_passed字段（物料来源验证是否通过）
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'apps_kuaizhizao_demand_computation_items' 
                    AND column_name = 'source_validation_passed'
                ) THEN
                    ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
                    ADD COLUMN "source_validation_passed" BOOLEAN NOT NULL DEFAULT TRUE;
                    COMMENT ON COLUMN "apps_kuaizhizao_demand_computation_items"."source_validation_passed" IS '物料来源验证是否通过';
                END IF;
                
                -- 添加source_validation_errors字段（物料来源验证错误信息）
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'apps_kuaizhizao_demand_computation_items' 
                    AND column_name = 'source_validation_errors'
                ) THEN
                    ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
                    ADD COLUMN "source_validation_errors" JSONB NULL;
                    COMMENT ON COLUMN "apps_kuaizhizao_demand_computation_items"."source_validation_errors" IS '物料来源验证错误信息（JSON格式）';
                END IF;
                
                -- 添加表注释
                COMMENT ON TABLE "apps_kuaizhizao_demand_computation_items" IS '快格轻制造 - 统一需求计算明细（已添加物料来源相关字段）';
            END IF;
        END $$;
        
        -- 添加表注释
        COMMENT ON TABLE "apps_master_data_materials" IS '物料表（已添加物料来源控制字段）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除物料来源控制字段
    """
    return """
        -- ============================================
        -- DemandComputationItem表：移除物料来源相关字段
        -- ============================================
        
        ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
        DROP COLUMN IF EXISTS "source_validation_errors";
        
        ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
        DROP COLUMN IF EXISTS "source_validation_passed";
        
        ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
        DROP COLUMN IF EXISTS "material_source_config";
        
        ALTER TABLE "apps_kuaizhizao_demand_computation_items" 
        DROP COLUMN IF EXISTS "material_source_type";
        
        -- ============================================
        -- Material表：移除物料来源控制字段
        -- ============================================
        
        DROP INDEX IF EXISTS "idx_apps_master_data_materials_source_type";
        
        ALTER TABLE "apps_master_data_materials" 
        DROP COLUMN IF EXISTS "source_config";
        
        ALTER TABLE "apps_master_data_materials" 
        DROP COLUMN IF EXISTS "source_type";
    """
