"""
添加委外工单管理相关模型

根据功能点2.1.10：委外工单管理（核心功能，新增）

包含：
1. apps_kuaizhizao_outsource_work_orders - 委外工单
2. apps_kuaizhizao_outsource_material_issues - 委外发料
3. apps_kuaizhizao_outsource_material_receipts - 委外收货

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加委外工单管理相关模型
    """
    return """
        -- ============================================
        -- 1. 创建委外工单表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_work_orders" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "name" VARCHAR(200),
            "product_id" INT NOT NULL,
            "product_code" VARCHAR(50) NOT NULL,
            "product_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(18,2) NOT NULL,
            "supplier_id" INT NOT NULL,
            "supplier_code" VARCHAR(50) NOT NULL,
            "supplier_name" VARCHAR(200) NOT NULL,
            "outsource_operation" VARCHAR(200),
            "unit_price" DECIMAL(18,2),
            "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "priority" VARCHAR(10) NOT NULL DEFAULT 'normal',
            "is_frozen" BOOLEAN NOT NULL DEFAULT FALSE,
            "freeze_reason" TEXT,
            "frozen_at" TIMESTAMPTZ,
            "frozen_by" INT,
            "frozen_by_name" VARCHAR(100),
            "planned_start_date" TIMESTAMPTZ,
            "planned_end_date" TIMESTAMPTZ,
            "actual_start_date" TIMESTAMPTZ,
            "actual_end_date" TIMESTAMPTZ,
            "received_quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "qualified_quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "unqualified_quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "issued_quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "remarks" TEXT,
            "created_by" INT NOT NULL,
            "created_by_name" VARCHAR(100) NOT NULL,
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_tenant_id" ON "apps_kuaizhizao_outsource_work_orders" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_code" ON "apps_kuaizhizao_outsource_work_orders" ("code");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_uuid" ON "apps_kuaizhizao_outsource_work_orders" ("uuid");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_product_id" ON "apps_kuaizhizao_outsource_work_orders" ("product_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_supplier_id" ON "apps_kuaizhizao_outsource_work_orders" ("supplier_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_status" ON "apps_kuaizhizao_outsource_work_orders" ("status");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_planned_start_date" ON "apps_kuaizhizao_outsource_work_orders" ("planned_start_date");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_planned_end_date" ON "apps_kuaizhizao_outsource_work_orders" ("planned_end_date");
        CREATE INDEX IF NOT EXISTS "idx_outsource_work_orders_created_at" ON "apps_kuaizhizao_outsource_work_orders" ("created_at");

        -- 创建唯一约束
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_outsource_work_orders_tenant_code" ON "apps_kuaizhizao_outsource_work_orders" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        -- ============================================
        -- 2. 创建委外发料表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_material_issues" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "outsource_work_order_id" INT NOT NULL,
            "outsource_work_order_code" VARCHAR(50) NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "quantity" DECIMAL(18,2) NOT NULL,
            "unit" VARCHAR(20) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "location_id" INT,
            "location_name" VARCHAR(200),
            "batch_number" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "issued_at" TIMESTAMPTZ,
            "issued_by" INT,
            "issued_by_name" VARCHAR(100),
            "remarks" TEXT,
            "created_by" INT NOT NULL,
            "created_by_name" VARCHAR(100) NOT NULL,
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_tenant_id" ON "apps_kuaizhizao_outsource_material_issues" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_code" ON "apps_kuaizhizao_outsource_material_issues" ("code");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_outsource_work_order_id" ON "apps_kuaizhizao_outsource_material_issues" ("outsource_work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_material_id" ON "apps_kuaizhizao_outsource_material_issues" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_warehouse_id" ON "apps_kuaizhizao_outsource_material_issues" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_status" ON "apps_kuaizhizao_outsource_material_issues" ("status");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_issued_at" ON "apps_kuaizhizao_outsource_material_issues" ("issued_at");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_issues_created_at" ON "apps_kuaizhizao_outsource_material_issues" ("created_at");

        -- 创建唯一约束
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_outsource_material_issues_tenant_code" ON "apps_kuaizhizao_outsource_material_issues" ("tenant_id", "code") WHERE "deleted_at" IS NULL;

        -- ============================================
        -- 3. 创建委外收货表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_outsource_material_receipts" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "code" VARCHAR(50) NOT NULL,
            "outsource_work_order_id" INT NOT NULL,
            "outsource_work_order_code" VARCHAR(50) NOT NULL,
            "quantity" DECIMAL(18,2) NOT NULL,
            "qualified_quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "unqualified_quantity" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "unit" VARCHAR(20) NOT NULL,
            "warehouse_id" INT,
            "warehouse_name" VARCHAR(200),
            "location_id" INT,
            "location_name" VARCHAR(200),
            "batch_number" VARCHAR(100),
            "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
            "received_at" TIMESTAMPTZ,
            "received_by" INT,
            "received_by_name" VARCHAR(100),
            "remarks" TEXT,
            "created_by" INT NOT NULL,
            "created_by_name" VARCHAR(100) NOT NULL,
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "deleted_at" TIMESTAMPTZ
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_tenant_id" ON "apps_kuaizhizao_outsource_material_receipts" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_code" ON "apps_kuaizhizao_outsource_material_receipts" ("code");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_outsource_work_order_id" ON "apps_kuaizhizao_outsource_material_receipts" ("outsource_work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_warehouse_id" ON "apps_kuaizhizao_outsource_material_receipts" ("warehouse_id");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_status" ON "apps_kuaizhizao_outsource_material_receipts" ("status");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_received_at" ON "apps_kuaizhizao_outsource_material_receipts" ("received_at");
        CREATE INDEX IF NOT EXISTS "idx_outsource_material_receipts_created_at" ON "apps_kuaizhizao_outsource_material_receipts" ("created_at");

        -- 创建唯一约束
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_outsource_material_receipts_tenant_code" ON "apps_kuaizhizao_outsource_material_receipts" ("tenant_id", "code") WHERE "deleted_at" IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除委外工单管理相关模型
    """
    return """
        -- 删除表（按依赖关系顺序）
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_material_receipts";
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_material_issues";
        DROP TABLE IF EXISTS "apps_kuaizhizao_outsource_work_orders";
    """
