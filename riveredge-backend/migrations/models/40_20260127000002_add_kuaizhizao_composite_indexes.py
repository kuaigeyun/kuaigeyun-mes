"""
添加kuaizhizao表复合索引迁移

为kuaizhizao应用的表添加缺失的复合索引，优化常用组合查询的性能。

变更内容：
- apps_kuaizhizao_work_orders 表的复合索引
- apps_kuaizhizao_reporting_records 表的复合索引
- apps_kuaizhizao_sales_orders 表的复合索引
- apps_kuaizhizao_purchase_orders 表的复合索引
- apps_kuaizhizao_demands 表的复合索引
- 其他常用查询表的复合索引
- 使用幂等性检查，如果索引已存在则跳过

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加kuaizhizao表的复合索引
    
    此迁移将为kuaizhizao应用的所有表添加缺失的复合索引，优化常用组合查询的性能。
    使用幂等性检查，如果索引已存在则跳过。
    """
    return """
        -- ============================================
        -- apps_kuaizhizao_work_orders 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + status + created_at (按组织+状态+时间查询，最常用)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_status_created_at'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_status_created_at" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "status", "created_at" DESC);
            END IF;
            
            -- tenant_id + production_mode + status (按组织+生产模式+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_production_mode_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_production_mode_status" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "production_mode", "status");
            END IF;
            
            -- tenant_id + workshop_id + status (按组织+车间+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_workshop_id_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_workshop_id_status" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "workshop_id", "status");
            END IF;
            
            -- tenant_id + work_center_id + status (按组织+工作中心+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_work_center_id_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_work_center_id_status" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "work_center_id", "status");
            END IF;
            
            -- tenant_id + product_id + status (按组织+产品+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_product_id_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_product_id_status" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "product_id", "status");
            END IF;
            
            -- tenant_id + deleted_at + created_at (软删除查询优化)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_deleted_at_created_at'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_deleted_at_created_at" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "deleted_at", "created_at" DESC)
                WHERE "deleted_at" IS NULL;
            END IF;
            
            -- tenant_id + planned_start_date + planned_end_date (计划时间范围查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_work_orders' 
                AND indexname = 'idx_apps_kuaizhizao_work_orders_tenant_id_planned_dates'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_work_orders_tenant_id_planned_dates" 
                ON "apps_kuaizhizao_work_orders" ("tenant_id", "planned_start_date", "planned_end_date");
            END IF;
        END $$;
        
        -- ============================================
        -- apps_kuaizhizao_reporting_records 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + work_order_id + status (按组织+工单+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_reporting_records' 
                AND indexname = 'idx_apps_kuaizhizao_reporting_records_tenant_id_work_order_id_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_reporting_records_tenant_id_work_order_id_status" 
                ON "apps_kuaizhizao_reporting_records" ("tenant_id", "work_order_id", "status");
            END IF;
            
            -- tenant_id + operation_id + created_at (按组织+工序+时间查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_reporting_records' 
                AND indexname = 'idx_apps_kuaizhizao_reporting_records_tenant_id_operation_id_created_at'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_reporting_records_tenant_id_operation_id_created_at" 
                ON "apps_kuaizhizao_reporting_records" ("tenant_id", "operation_id", "created_at" DESC);
            END IF;
            
            -- tenant_id + reporter_id + created_at (按组织+报工人+时间查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_reporting_records' 
                AND indexname = 'idx_apps_kuaizhizao_reporting_records_tenant_id_reporter_id_created_at'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_reporting_records_tenant_id_reporter_id_created_at" 
                ON "apps_kuaizhizao_reporting_records" ("tenant_id", "reporter_id", "created_at" DESC);
            END IF;
        END $$;
        
        -- ============================================
        -- apps_kuaizhizao_sales_orders 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + customer_id + status (按组织+客户+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_sales_orders' 
                AND indexname = 'idx_apps_kuaizhizao_sales_orders_tenant_id_customer_id_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_sales_orders_tenant_id_customer_id_status" 
                ON "apps_kuaizhizao_sales_orders" ("tenant_id", "customer_id", "status");
            END IF;
            
            -- tenant_id + status + order_date (按组织+状态+订单日期查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_sales_orders' 
                AND indexname = 'idx_apps_kuaizhizao_sales_orders_tenant_id_status_order_date'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_sales_orders_tenant_id_status_order_date" 
                ON "apps_kuaizhizao_sales_orders" ("tenant_id", "status", "order_date" DESC);
            END IF;
            
            -- tenant_id + delivery_date + status (按组织+交货日期+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_sales_orders' 
                AND indexname = 'idx_apps_kuaizhizao_sales_orders_tenant_id_delivery_date_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_sales_orders_tenant_id_delivery_date_status" 
                ON "apps_kuaizhizao_sales_orders" ("tenant_id", "delivery_date", "status");
            END IF;
        END $$;
        
        -- ============================================
        -- apps_kuaizhizao_purchase_orders 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + supplier_id + status (按组织+供应商+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_purchase_orders' 
                AND indexname = 'idx_apps_kuaizhizao_purchase_orders_tenant_id_supplier_id_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_purchase_orders_tenant_id_supplier_id_status" 
                ON "apps_kuaizhizao_purchase_orders" ("tenant_id", "supplier_id", "status");
            END IF;
            
            -- tenant_id + status + order_date (按组织+状态+订单日期查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_purchase_orders' 
                AND indexname = 'idx_apps_kuaizhizao_purchase_orders_tenant_id_status_order_date'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_purchase_orders_tenant_id_status_order_date" 
                ON "apps_kuaizhizao_purchase_orders" ("tenant_id", "status", "order_date" DESC);
            END IF;
        END $$;
        
        -- ============================================
        -- apps_kuaizhizao_demands 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + demand_type + status (按组织+需求类型+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_demands' 
                AND indexname = 'idx_apps_kuaizhizao_demands_tenant_id_demand_type_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_demands_tenant_id_demand_type_status" 
                ON "apps_kuaizhizao_demands" ("tenant_id", "demand_type", "status");
            END IF;
            
            -- tenant_id + business_mode + status (按组织+业务模式+状态查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_demands' 
                AND indexname = 'idx_apps_kuaizhizao_demands_tenant_id_business_mode_status'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_demands_tenant_id_business_mode_status" 
                ON "apps_kuaizhizao_demands" ("tenant_id", "business_mode", "status");
            END IF;
            
            -- tenant_id + start_date + end_date (按组织+时间范围查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_demands' 
                AND indexname = 'idx_apps_kuaizhizao_demands_tenant_id_start_date_end_date'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_demands_tenant_id_start_date_end_date" 
                ON "apps_kuaizhizao_demands" ("tenant_id", "start_date", "end_date");
            END IF;
        END $$;
        
        -- ============================================
        -- apps_kuaizhizao_inventory_transactions 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + material_id + transaction_type + created_at (按组织+物料+类型+时间查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_inventory_transactions' 
                AND indexname = 'idx_apps_kuaizhizao_inventory_transactions_tenant_id_material_id_type_created_at'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_inventory_transactions_tenant_id_material_id_type_created_at" 
                ON "apps_kuaizhizao_inventory_transactions" ("tenant_id", "material_id", "transaction_type", "created_at" DESC);
            END IF;
            
            -- tenant_id + warehouse_id + material_id (按组织+仓库+物料查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_inventory_transactions' 
                AND indexname = 'idx_apps_kuaizhizao_inventory_transactions_tenant_id_warehouse_id_material_id'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_inventory_transactions_tenant_id_warehouse_id_material_id" 
                ON "apps_kuaizhizao_inventory_transactions" ("tenant_id", "warehouse_id", "material_id");
            END IF;
        END $$;
        
        -- ============================================
        -- apps_kuaizhizao_quality_inspections 表的复合索引
        -- ============================================
        DO $$
        BEGIN
            -- tenant_id + work_order_id + inspection_type + created_at (按组织+工单+类型+时间查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_quality_inspections' 
                AND indexname = 'idx_apps_kuaizhizao_quality_inspections_tenant_id_work_order_id_type_created_at'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_quality_inspections_tenant_id_work_order_id_type_created_at" 
                ON "apps_kuaizhizao_quality_inspections" ("tenant_id", "work_order_id", "inspection_type", "created_at" DESC);
            END IF;
            
            -- tenant_id + status + inspection_result (按组织+状态+结果查询)
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'apps_kuaizhizao_quality_inspections' 
                AND indexname = 'idx_apps_kuaizhizao_quality_inspections_tenant_id_status_result'
            ) THEN
                CREATE INDEX "idx_apps_kuaizhizao_quality_inspections_tenant_id_status_result" 
                ON "apps_kuaizhizao_quality_inspections" ("tenant_id", "status", "inspection_result");
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除kuaizhizao表的复合索引
    
    注意：此操作会删除所有通过此迁移创建的索引。
    """
    return """
        -- 删除 apps_kuaizhizao_work_orders 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_status_created_at";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_production_mode_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_workshop_id_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_work_center_id_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_product_id_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_deleted_at_created_at";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_work_orders_tenant_id_planned_dates";
        
        -- 删除 apps_kuaizhizao_reporting_records 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_reporting_records_tenant_id_work_order_id_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_reporting_records_tenant_id_operation_id_created_at";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_reporting_records_tenant_id_reporter_id_created_at";
        
        -- 删除 apps_kuaizhizao_sales_orders 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_sales_orders_tenant_id_customer_id_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_sales_orders_tenant_id_status_order_date";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_sales_orders_tenant_id_delivery_date_status";
        
        -- 删除 apps_kuaizhizao_purchase_orders 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_purchase_orders_tenant_id_supplier_id_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_purchase_orders_tenant_id_status_order_date";
        
        -- 删除 apps_kuaizhizao_demands 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_demands_tenant_id_demand_type_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_demands_tenant_id_business_mode_status";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_demands_tenant_id_start_date_end_date";
        
        -- 删除 apps_kuaizhizao_inventory_transactions 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_inventory_transactions_tenant_id_material_id_type_created_at";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_inventory_transactions_tenant_id_warehouse_id_material_id";
        
        -- 删除 apps_kuaizhizao_quality_inspections 表的复合索引
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quality_inspections_tenant_id_work_order_id_type_created_at";
        DROP INDEX IF EXISTS "idx_apps_kuaizhizao_quality_inspections_tenant_id_status_result";
    """