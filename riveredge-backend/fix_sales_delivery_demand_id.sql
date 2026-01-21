-- 修复销售出库单表缺少字段的问题
-- 执行此 SQL 脚本以添加缺失的字段
-- 根据迁移脚本：36_20260117000000_enhance_sales_delivery_models.py

-- ============================================
-- 1. 增强销售出库单表（apps_kuaizhizao_sales_deliveries）
-- ============================================

-- 添加销售预测关联字段（MTS模式）- 必须先添加这些字段
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

-- 创建索引
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36b1c3" 
ON "apps_kuaizhizao_sales_deliveries" ("demand_id");

CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36c1d4" 
ON "apps_kuaizhizao_sales_deliveries" ("demand_code");

CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36d1e5" 
ON "apps_kuaizhizao_sales_deliveries" ("demand_type");

-- 添加销售预测关联字段（如果需要）
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

-- 创建销售预测索引
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_sales_f_36a1b2" 
ON "apps_kuaizhizao_sales_deliveries" ("sales_forecast_id");

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

-- 创建明细表索引（批号和序列号选择功能增强，销售出库与需求关联功能增强）
CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_batch_n_36e1f6" 
ON "apps_kuaizhizao_sales_delivery_items" ("batch_number");

CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36f1g7" 
ON "apps_kuaizhizao_sales_delivery_items" ("demand_id");

CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand__36g1h8" 
ON "apps_kuaizhizao_sales_delivery_items" ("demand_item_id");
