"""
增强销售出库模型

根据功能点3.2.1：销售出库数据模型设计
根据功能点3.2.7：批号和序列号选择功能
根据功能点3.2.8：销售出库与需求关联功能

包含：
1. 添加序列号字段（serial_numbers，JSON格式，存储多个序列号）
2. 添加销售预测关联字段（sales_forecast_id, sales_forecast_code）
3. 添加统一需求关联字段（demand_id, demand_code, demand_type）
4. 添加需求明细关联字段（demand_item_id）

Author: Auto (AI Assistant)
Date: 2026-01-17
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：增强销售出库模型
    """
    return """
        -- ============================================
        -- 1. 增强销售出库单表（apps_kuaizhizao_sales_deliveries）
        -- ============================================
        
        -- 添加销售预测关联字段（MTS模式）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
                AND column_name = 'sales_forecast_id'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD COLUMN "sales_forecast_id" INT;
                COMMENT ON COLUMN "apps_kuaizhizao_sales_deliveries"."sales_forecast_id" IS '销售预测ID（MTS模式）';
            END IF;
        END $$;
        
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
                AND column_name = 'sales_forecast_code'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD COLUMN "sales_forecast_code" VARCHAR(50);
                COMMENT ON COLUMN "apps_kuaizhizao_sales_deliveries"."sales_forecast_code" IS '销售预测编码（MTS模式）';
            END IF;
        END $$;
        
        -- 添加统一需求关联字段（销售出库与需求关联功能增强）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
                AND column_name = 'demand_id'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD COLUMN "demand_id" INT;
                COMMENT ON COLUMN "apps_kuaizhizao_sales_deliveries"."demand_id" IS '需求ID（关联统一需求表，MTS关联销售预测，MTO关联销售订单）';
            END IF;
        END $$;
        
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
                AND column_name = 'demand_code'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD COLUMN "demand_code" VARCHAR(50);
                COMMENT ON COLUMN "apps_kuaizhizao_sales_deliveries"."demand_code" IS '需求编码';
            END IF;
        END $$;
        
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
                AND column_name = 'demand_type'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD COLUMN "demand_type" VARCHAR(20);
                COMMENT ON COLUMN "apps_kuaizhizao_sales_deliveries"."demand_type" IS '需求类型（sales_forecast/sales_order）';
            END IF;
        END $$;
        
        -- 创建索引（销售出库与需求关联功能增强）
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_f_36a1b2" 
        ON "apps_kuaizhizao_sales_deliveries" ("sales_forecast_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36b1c3" 
        ON "apps_kuaizhizao_sales_deliveries" ("demand_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36c1d4" 
        ON "apps_kuaizhizao_sales_deliveries" ("demand_code");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36d1e5" 
        ON "apps_kuaizhizao_sales_deliveries" ("demand_type");
        
        -- ============================================
        -- 2. 增强销售出库单明细表（apps_kuaizhizao_sales_delivery_items）
        -- ============================================
        
        -- 添加序列号字段（批号和序列号选择功能增强）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_delivery_items' 
                AND column_name = 'serial_numbers'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_delivery_items" 
                ADD COLUMN "serial_numbers" JSONB;
                COMMENT ON COLUMN "apps_kuaizhizao_sales_delivery_items"."serial_numbers" IS '序列号列表（JSON格式，存储多个序列号）';
            END IF;
        END $$;
        
        -- 添加需求关联字段（销售出库与需求关联功能增强）
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_delivery_items' 
                AND column_name = 'demand_id'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_delivery_items" 
                ADD COLUMN "demand_id" INT;
                COMMENT ON COLUMN "apps_kuaizhizao_sales_delivery_items"."demand_id" IS '需求ID（关联统一需求表）';
            END IF;
        END $$;
        
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_delivery_items' 
                AND column_name = 'demand_item_id'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_delivery_items" 
                ADD COLUMN "demand_item_id" INT;
                COMMENT ON COLUMN "apps_kuaizhizao_sales_delivery_items"."demand_item_id" IS '需求明细ID';
            END IF;
        END $$;
        
        -- 创建索引（批号和序列号选择功能增强，销售出库与需求关联功能增强）
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batch_n_36e1f6" 
        ON "apps_kuaizhizao_sales_delivery_items" ("batch_number");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36f1g7" 
        ON "apps_kuaizhizao_sales_delivery_items" ("demand_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36g1h8" 
        ON "apps_kuaizhizao_sales_delivery_items" ("demand_item_id");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：移除增强字段
    """
    return """
        -- ============================================
        -- 1. 移除销售出库单表的增强字段
        -- ============================================
        
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_kuaizh_demand__36d1e5";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_demand__36c1d4";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_demand__36b1c3";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_sales_f_36a1b2";
        
        -- 删除字段
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        DROP COLUMN IF EXISTS "demand_type";
        
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        DROP COLUMN IF EXISTS "demand_code";
        
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        DROP COLUMN IF EXISTS "demand_id";
        
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        DROP COLUMN IF EXISTS "sales_forecast_code";
        
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        DROP COLUMN IF EXISTS "sales_forecast_id";
        
        -- ============================================
        -- 2. 移除销售出库单明细表的增强字段
        -- ============================================
        
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_kuaizh_demand__36g1h8";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_demand__36f1g7";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_batch_n_36e1f6";
        
        -- 删除字段
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items" 
        DROP COLUMN IF EXISTS "demand_item_id";
        
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items" 
        DROP COLUMN IF EXISTS "demand_id";
        
        ALTER TABLE "apps_kuaizhizao_sales_delivery_items" 
        DROP COLUMN IF EXISTS "serial_numbers";
    """
