"""
添加部分唯一索引以支持软删除

为所有使用 (tenant_id, code) 唯一约束的表添加部分唯一索引（Partial Unique Index），
确保软删除后的记录可以使用相同的 code 重新创建。

变更内容：
- 删除旧的唯一索引/约束
- 创建新的部分唯一索引：WHERE deleted_at IS NULL
- 支持软删除后重用编码

Author: Auto (AI Assistant)
Date: 2026-01-22
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加部分唯一索引
    
    为所有主数据管理表添加部分唯一索引，确保软删除后的记录可以使用相同的 code 重新创建。
    """
    return """
        -- ============================================
        -- 工厂数据表
        -- ============================================
        
        -- 厂区表 (apps_master_data_plants)
        -- 删除旧的唯一约束（如果存在）
        DO $$
        BEGIN
            -- 删除通过 CONSTRAINT 创建的唯一约束
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'uid_apps_master_tenant__abb742'
            ) THEN
                ALTER TABLE "apps_master_data_plants" 
                DROP CONSTRAINT "uid_apps_master_tenant__abb742";
            END IF;
            
            -- 删除通过 CREATE UNIQUE INDEX 创建的索引（如果存在）
            DROP INDEX IF EXISTS "idx_apps_master_data_plants_tenant_code";
        END $$;
        
        -- 创建部分唯一索引
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_plants_tenant_code" 
        ON "apps_master_data_plants" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 车间表 (apps_master_data_workshops)
        DROP INDEX IF EXISTS "idx_apps_master_data_workshops_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_tenant_code" 
        ON "apps_master_data_workshops" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 产线表 (apps_master_data_production_lines)
        DROP INDEX IF EXISTS "idx_apps_master_data_production_lines_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_tenant_code" 
        ON "apps_master_data_production_lines" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 工位表 (apps_master_data_workstations)
        DROP INDEX IF EXISTS "idx_apps_master_data_workstations_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_tenant_code" 
        ON "apps_master_data_workstations" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- ============================================
        -- 仓库数据表
        -- ============================================
        
        -- 仓库表 (apps_master_data_warehouses)
        DROP INDEX IF EXISTS "idx_apps_master_data_warehouses_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_tenant_code" 
        ON "apps_master_data_warehouses" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 库区表 (apps_master_data_storage_areas)
        DROP INDEX IF EXISTS "idx_apps_master_data_storage_areas_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_tenant_code" 
        ON "apps_master_data_storage_areas" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 库位表 (apps_master_data_storage_locations)
        DROP INDEX IF EXISTS "idx_apps_master_data_storage_locations_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_tenant_code" 
        ON "apps_master_data_storage_locations" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- ============================================
        -- 物料数据表
        -- ============================================
        
        -- 物料分组表 (apps_master_data_material_groups)
        DROP INDEX IF EXISTS "idx_apps_master_data_material_groups_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_code" 
        ON "apps_master_data_material_groups" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 物料表 (apps_master_data_materials) - 使用 code 字段
        DROP INDEX IF EXISTS "idx_apps_master_data_materials_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_code" 
        ON "apps_master_data_materials" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 物料表 (apps_master_data_materials) - 使用 main_code 字段（如果存在）
        -- 注意：main_code 的唯一索引已在其他迁移中处理，这里只处理 code
        
        -- ============================================
        -- 工艺数据表
        -- ============================================
        
        -- 不良品类型表 (apps_master_data_defect_types)
        DROP INDEX IF EXISTS "idx_apps_master_data_defect_types_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_tenant_code" 
        ON "apps_master_data_defect_types" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 工序表 (apps_master_data_operations)
        DROP INDEX IF EXISTS "idx_apps_master_data_operations_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_operations_tenant_code" 
        ON "apps_master_data_operations" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 工艺路线表 (apps_master_data_process_routes)
        -- 注意：工艺路线使用 (tenant_id, code, version) 作为唯一约束
        -- 需要删除旧的唯一约束，创建部分唯一索引
        DO $$
        BEGIN
            -- 删除旧的唯一约束（如果存在）
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'apps_master_data_process_routes_tenant_id_code_version_key'
            ) THEN
                ALTER TABLE "apps_master_data_process_routes" 
                DROP CONSTRAINT "apps_master_data_process_routes_tenant_id_code_version_key";
            END IF;
            
            -- 删除通过 CREATE UNIQUE INDEX 创建的索引（如果存在）
            DROP INDEX IF EXISTS "idx_apps_master_data_process_routes_tenant_code_version";
        END $$;
        
        -- 创建部分唯一索引（WHERE deleted_at IS NULL）
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_process_routes_tenant_code_version" 
        ON "apps_master_data_process_routes" ("tenant_id", "code", "version") 
        WHERE "deleted_at" IS NULL;
        
        -- 作业程序表 (apps_master_data_sop)
        -- 注意：SOP 使用 (tenant_id, code, version) 作为唯一约束
        -- 需要删除旧的唯一索引，创建部分唯一索引
        DROP INDEX IF EXISTS "idx_apps_master_data_sop_tenant_code_version";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_sop_tenant_code_version" 
        ON "apps_master_data_sop" ("tenant_id", "code", "version") 
        WHERE "deleted_at" IS NULL;
        
        -- 物料表 (apps_master_data_materials) - 使用 main_code 字段
        -- 注意：物料表同时有 code 和 main_code 字段，main_code 也需要部分唯一索引
        DROP INDEX IF EXISTS "uid_apps_master_tenant__64e181";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_main_code" 
        ON "apps_master_data_materials" ("tenant_id", "main_code") 
        WHERE "deleted_at" IS NULL;
        
        -- ============================================
        -- 供应链数据表
        -- ============================================
        
        -- 客户表 (apps_master_data_customers)
        DROP INDEX IF EXISTS "idx_apps_master_data_customers_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_code" 
        ON "apps_master_data_customers" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- 供应商表 (apps_master_data_suppliers)
        DROP INDEX IF EXISTS "idx_apps_master_data_suppliers_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_code" 
        ON "apps_master_data_suppliers" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- ============================================
        -- 绩效数据表
        -- ============================================
        
        -- 技能表 (apps_master_data_skills)
        DROP INDEX IF EXISTS "idx_apps_master_data_skills_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_skills_tenant_code" 
        ON "apps_master_data_skills" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
        
        -- ============================================
        -- 产品表
        -- ============================================
        
        -- 产品表 (apps_master_data_products)
        DROP INDEX IF EXISTS "idx_apps_master_data_products_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_code" 
        ON "apps_master_data_products" ("tenant_id", "code") 
        WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：恢复旧的唯一索引
    
    删除部分唯一索引，恢复普通的唯一索引（不包含 WHERE 条件）。
    """
    return """
        -- ============================================
        -- 工厂数据表
        -- ============================================
        
        -- 厂区表
        DROP INDEX IF EXISTS "idx_apps_master_data_plants_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_plants_tenant_code" 
        ON "apps_master_data_plants" ("tenant_id", "code");
        
        -- 车间表
        DROP INDEX IF EXISTS "idx_apps_master_data_workshops_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workshops_tenant_code" 
        ON "apps_master_data_workshops" ("tenant_id", "code");
        
        -- 产线表
        DROP INDEX IF EXISTS "idx_apps_master_data_production_lines_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_production_lines_tenant_code" 
        ON "apps_master_data_production_lines" ("tenant_id", "code");
        
        -- 工位表
        DROP INDEX IF EXISTS "idx_apps_master_data_workstations_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_workstations_tenant_code" 
        ON "apps_master_data_workstations" ("tenant_id", "code");
        
        -- ============================================
        -- 仓库数据表
        -- ============================================
        
        -- 仓库表
        DROP INDEX IF EXISTS "idx_apps_master_data_warehouses_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_warehouses_tenant_code" 
        ON "apps_master_data_warehouses" ("tenant_id", "code");
        
        -- 库区表
        DROP INDEX IF EXISTS "idx_apps_master_data_storage_areas_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_areas_tenant_code" 
        ON "apps_master_data_storage_areas" ("tenant_id", "code");
        
        -- 库位表
        DROP INDEX IF EXISTS "idx_apps_master_data_storage_locations_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_storage_locations_tenant_code" 
        ON "apps_master_data_storage_locations" ("tenant_id", "code");
        
        -- ============================================
        -- 物料数据表
        -- ============================================
        
        -- 物料分组表
        DROP INDEX IF EXISTS "idx_apps_master_data_material_groups_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_material_groups_tenant_code" 
        ON "apps_master_data_material_groups" ("tenant_id", "code");
        
        -- 物料表
        DROP INDEX IF EXISTS "idx_apps_master_data_materials_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_materials_tenant_code" 
        ON "apps_master_data_materials" ("tenant_id", "code");
        
        -- ============================================
        -- 工艺数据表
        -- ============================================
        
        -- 不良品类型表
        DROP INDEX IF EXISTS "idx_apps_master_data_defect_types_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_defect_types_tenant_code" 
        ON "apps_master_data_defect_types" ("tenant_id", "code");
        
        -- 工序表
        DROP INDEX IF EXISTS "idx_apps_master_data_operations_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_operations_tenant_code" 
        ON "apps_master_data_operations" ("tenant_id", "code");
        
        -- ============================================
        -- 供应链数据表
        -- ============================================
        
        -- 客户表
        DROP INDEX IF EXISTS "idx_apps_master_data_customers_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_customers_tenant_code" 
        ON "apps_master_data_customers" ("tenant_id", "code");
        
        -- 供应商表
        DROP INDEX IF EXISTS "idx_apps_master_data_suppliers_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_suppliers_tenant_code" 
        ON "apps_master_data_suppliers" ("tenant_id", "code");
        
        -- ============================================
        -- 绩效数据表
        -- ============================================
        
        -- 技能表
        DROP INDEX IF EXISTS "idx_apps_master_data_skills_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_skills_tenant_code" 
        ON "apps_master_data_skills" ("tenant_id", "code");
        
        -- ============================================
        -- 产品表
        -- ============================================
        
        -- 产品表
        DROP INDEX IF EXISTS "idx_apps_master_data_products_tenant_code";
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_apps_master_data_products_tenant_code" 
        ON "apps_master_data_products" ("tenant_id", "code");
    """