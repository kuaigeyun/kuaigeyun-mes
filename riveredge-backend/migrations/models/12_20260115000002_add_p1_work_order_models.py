"""
添加工单管理相关模型（P1优先级）

包含：
1. apps_kuaizhizao_rework_orders - 返工单
2. apps_kuaizhizao_outsource_orders - 委外单

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加工单管理相关模型
    """
    return """
        -- ============================================
        -- 1. 创建返工单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_rework_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "original_work_order_id" INT,
            "original_work_order_uuid" VARCHAR(36),
            "product_id" INT NOT NULL,
            "product_code" VARCHAR(50) NOT NULL,
            "product_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(18,4) NOT NULL,
            "rework_reason" TEXT NOT NULL,
            "rework_type" VARCHAR(50) NOT NULL,
            "route_id" INT,
            "route_name" VARCHAR(200),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "planned_start_date" TIMESTAMPTZ,
            "planned_end_date" TIMESTAMPTZ,
            "actual_start_date" TIMESTAMPTZ,
            "actual_end_date" TIMESTAMPTZ,
            "work_center_id" INT,
            "work_center_name" VARCHAR(200),
            "operator_id" INT,
            "operator_name" VARCHAR(100),
            "cost" DECIMAL(18,4),
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_rework_orders_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_tenant_id" ON "apps_kuaizhizao_rework_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_code" ON "apps_kuaizhizao_rework_orders" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_uuid" ON "apps_kuaizhizao_rework_orders" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_original_wo_id" ON "apps_kuaizhizao_rework_orders" ("original_work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_original_wo_uuid" ON "apps_kuaizhizao_rework_orders" ("original_work_order_uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_status" ON "apps_kuaizhizao_rework_orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_product_id" ON "apps_kuaizhizao_rework_orders" ("product_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_work_center_id" ON "apps_kuaizhizao_rework_orders" ("work_center_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_planned_start" ON "apps_kuaizhizao_rework_orders" ("planned_start_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_rework_orders_created_at" ON "apps_kuaizhizao_rework_orders" ("created_at");
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_rework_orders" IS '返工单模型';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."code" IS '返工单编码（组织内唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_rework_orders"."status" IS '返工状态（draft/released/in_progress/completed/cancelled）';
        
        -- ============================================
        -- 2. 创建委外单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "work_order_operation_id" INT,
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50) NOT NULL,
            "operation_name" VARCHAR(200) NOT NULL,
            "supplier_id" INT NOT NULL,
            "supplier_code" VARCHAR(50) NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "outsource_quantity" DECIMAL(18,4) NOT NULL,
            "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "qualified_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "unqualified_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
            "unit_price" DECIMAL(18,4),
            "total_amount" DECIMAL(18,4),
            "planned_start_date" TIMESTAMPTZ,
            "planned_end_date" TIMESTAMPTZ,
            "actual_start_date" TIMESTAMPTZ,
            "actual_end_date" TIMESTAMPTZ,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "purchase_receipt_id" INT,
            "purchase_receipt_code" VARCHAR(50),
            "remarks" TEXT,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_outsource_orders_tenant_code" UNIQUE ("tenant_id", "code")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_tenant_id" ON "apps_kuaizhizao_outsource_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_code" ON "apps_kuaizhizao_outsource_orders" ("code");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_uuid" ON "apps_kuaizhizao_outsource_orders" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_work_order_id" ON "apps_kuaizhizao_outsource_orders" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_wo_operation_id" ON "apps_kuaizhizao_outsource_orders" ("work_order_operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_operation_id" ON "apps_kuaizhizao_outsource_orders" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_supplier_id" ON "apps_kuaizhizao_outsource_orders" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_status" ON "apps_kuaizhizao_outsource_orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_planned_start" ON "apps_kuaizhizao_outsource_orders" ("planned_start_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_purchase_receipt_id" ON "apps_kuaizhizao_outsource_orders" ("purchase_receipt_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_outsource_orders_created_at" ON "apps_kuaizhizao_outsource_orders" ("created_at");
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_outsource_orders" IS '委外单模型';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_orders"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_orders"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_orders"."code" IS '委外单编码（组织内唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_outsource_orders"."status" IS '委外单状态（draft/released/in_progress/completed/cancelled）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除工单管理相关模型
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_orders" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_rework_orders" CASCADE;
    """

