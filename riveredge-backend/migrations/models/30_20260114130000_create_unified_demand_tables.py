"""
数据库迁移：创建统一需求表和需求明细表

创建 apps_kuaizhizao_demands 和 apps_kuaizhizao_demand_items 表，
用于统一管理销售预测和销售订单两种需求类型。

根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：创建统一需求表和需求明细表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 创建统一需求表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demands" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "demand_code" VARCHAR(50) NOT NULL,
            "demand_type" VARCHAR(20) NOT NULL,
            "demand_name" VARCHAR(200) NOT NULL,
            "business_mode" VARCHAR(20) NOT NULL,
            "start_date" DATE NOT NULL,
            "end_date" DATE,
            "customer_id" INTEGER,
            "customer_name" VARCHAR(200),
            "customer_contact" VARCHAR(100),
            "customer_phone" VARCHAR(20),
            "forecast_period" VARCHAR(20),
            "order_date" DATE,
            "delivery_date" DATE,
            "total_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT '草稿',
            "reviewer_id" INTEGER,
            "reviewer_name" VARCHAR(100),
            "review_time" TIMESTAMPTZ,
            "review_status" VARCHAR(20) NOT NULL DEFAULT '待审核',
            "review_remarks" TEXT,
            "salesman_id" INTEGER,
            "salesman_name" VARCHAR(100),
            "shipping_address" TEXT,
            "shipping_method" VARCHAR(50),
            "payment_terms" VARCHAR(100),
            "source_id" INTEGER,
            "source_type" VARCHAR(50),
            "source_code" VARCHAR(50),
            "pushed_to_computation" BOOLEAN NOT NULL DEFAULT false,
            "computation_id" INTEGER,
            "computation_code" VARCHAR(50),
            "notes" TEXT,
            "is_active" BOOLEAN NOT NULL DEFAULT true,
            "created_by" INTEGER,
            "updated_by" INTEGER,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_demand_c_123456" UNIQUE ("tenant_id", "demand_code")
        );
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_demands" IS '快格轻制造 - 统一需求';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."id" IS '主键ID（自增ID，内部使用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."tenant_id" IS '租户ID';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."demand_code" IS '需求编码';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."demand_type" IS '需求类型（sales_forecast 或 sales_order）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."demand_name" IS '需求名称';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."business_mode" IS '业务模式（MTS/MTO）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."start_date" IS '开始日期';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."end_date" IS '结束日期（销售订单可为空）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."customer_id" IS '客户ID（销售订单专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."customer_name" IS '客户名称（销售订单专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."forecast_period" IS '预测周期（销售预测专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."order_date" IS '订单日期（销售订单专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."delivery_date" IS '交货日期（销售订单专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."total_quantity" IS '总数量';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."total_amount" IS '总金额';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."status" IS '需求状态';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."review_status" IS '审核状态';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."pushed_to_computation" IS '是否已下推到需求计算';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."computation_id" IS '关联的需求计算ID';
        COMMENT ON COLUMN "apps_kuaizhizao_demands"."computation_code" IS '关联的需求计算编码';
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__demand_type" 
        ON "apps_kuaizhizao_demands" ("tenant_id", "demand_type");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__status" 
        ON "apps_kuaizhizao_demands" ("tenant_id", "status");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__business_mode" 
        ON "apps_kuaizhizao_demands" ("tenant_id", "business_mode");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_start_date" 
        ON "apps_kuaizhizao_demands" ("start_date");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_end_date" 
        ON "apps_kuaizhizao_demands" ("end_date");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_date" 
        ON "apps_kuaizhizao_demands" ("delivery_date");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_customer_id" 
        ON "apps_kuaizhizao_demands" ("customer_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_demand_code" 
        ON "apps_kuaizhizao_demands" ("demand_code");
        
        -- 创建统一需求明细表
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_demand_items" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INTEGER NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "demand_id" INTEGER NOT NULL,
            "material_id" INTEGER NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "material_spec" VARCHAR(200),
            "material_unit" VARCHAR(20) NOT NULL,
            "required_quantity" DECIMAL(10,2) NOT NULL,
            "forecast_date" DATE,
            "forecast_month" VARCHAR(7),
            "historical_sales" DECIMAL(10,2),
            "historical_period" VARCHAR(20),
            "confidence_level" DECIMAL(5,2),
            "forecast_method" VARCHAR(50),
            "delivery_date" DATE,
            "delivered_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
            "remaining_quantity" DECIMAL(10,2) NOT NULL,
            "unit_price" DECIMAL(10,2),
            "item_amount" DECIMAL(12,2),
            "delivery_status" VARCHAR(20),
            "work_order_id" INTEGER,
            "work_order_code" VARCHAR(50),
            "notes" TEXT
        );
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_demand_items" IS '快格轻制造 - 统一需求明细';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."id" IS '主键ID（自增ID，内部使用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."tenant_id" IS '租户ID';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."created_at" IS '创建时间（UTC）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."updated_at" IS '更新时间（UTC）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."demand_id" IS '需求ID';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."material_id" IS '物料ID';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."material_code" IS '物料编码';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."material_name" IS '物料名称';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."required_quantity" IS '需求数量';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."forecast_date" IS '预测日期（销售预测专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."forecast_month" IS '预测月份（YYYY-MM，销售预测专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."delivery_date" IS '交货日期（销售订单专用）';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."work_order_id" IS '工单ID（MTO模式）';
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_tenant__demand_id" 
        ON "apps_kuaizhizao_demand_items" ("tenant_id", "demand_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_material_id" 
        ON "apps_kuaizhizao_demand_items" ("material_id");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_forecast_date" 
        ON "apps_kuaizhizao_demand_items" ("forecast_date");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_forecast_month" 
        ON "apps_kuaizhizao_demand_items" ("forecast_month");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_date" 
        ON "apps_kuaizhizao_demand_items" ("delivery_date");
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_id" 
        ON "apps_kuaizhizao_demand_items" ("work_order_id");
        
        -- 创建外键约束
        ALTER TABLE "apps_kuaizhizao_demand_items" 
        ADD CONSTRAINT "fk_apps_kuaizhizao_demand_items_demand_id" 
        FOREIGN KEY ("demand_id") 
        REFERENCES "apps_kuaizhizao_demands" ("id") 
        ON DELETE CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除统一需求表和需求明细表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除外键约束
        ALTER TABLE "apps_kuaizhizao_demand_items" 
        DROP CONSTRAINT IF EXISTS "fk_apps_kuaizhizao_demand_items_demand_id";
        
        -- 删除索引
        DROP INDEX IF EXISTS "idx_apps_kuaizh_work_order_id";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_delivery_date";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_forecast_month";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_forecast_date";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_material_id";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant__demand_id";
        
        DROP INDEX IF EXISTS "idx_apps_kuaizh_demand_code";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_customer_id";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_delivery_date";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_end_date";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_start_date";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant__business_mode";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant__status";
        DROP INDEX IF EXISTS "idx_apps_kuaizh_tenant__demand_type";
        
        -- 删除表
        DROP TABLE IF EXISTS "apps_kuaizhizao_demand_items";
        DROP TABLE IF EXISTS "apps_kuaizhizao_demands";
    """
