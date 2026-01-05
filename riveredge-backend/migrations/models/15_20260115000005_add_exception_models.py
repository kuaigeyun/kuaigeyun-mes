"""
添加异常处理相关模型（P1优先级）

包含：
1. apps_kuaizhizao_material_shortage_exceptions - 缺料异常
2. apps_kuaizhizao_delivery_delay_exceptions - 延期异常
3. apps_kuaizhizao_quality_exceptions - 质量异常

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加异常处理相关模型
    """
    return """
        -- ============================================
        -- 1. 创建缺料异常表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_material_shortage_exceptions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "material_id" INT NOT NULL,
            "material_code" VARCHAR(50) NOT NULL,
            "material_name" VARCHAR(200) NOT NULL,
            "shortage_quantity" DECIMAL(12,2) NOT NULL,
            "available_quantity" DECIMAL(12,2) NOT NULL,
            "required_quantity" DECIMAL(12,2) NOT NULL,
            "alert_level" VARCHAR(20) NOT NULL DEFAULT 'medium',
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "alternative_material_id" INT,
            "alternative_material_code" VARCHAR(50),
            "alternative_material_name" VARCHAR(200),
            "suggested_action" VARCHAR(50),
            "handled_by" INT,
            "handled_by_name" VARCHAR(100),
            "handled_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mat_shortage_exc_tenant_id" ON "apps_kuaizhizao_material_shortage_exceptions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mat_shortage_exc_work_order_id" ON "apps_kuaizhizao_material_shortage_exceptions" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mat_shortage_exc_material_id" ON "apps_kuaizhizao_material_shortage_exceptions" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mat_shortage_exc_alert_level" ON "apps_kuaizhizao_material_shortage_exceptions" ("alert_level");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mat_shortage_exc_status" ON "apps_kuaizhizao_material_shortage_exceptions" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_mat_shortage_exc_created_at" ON "apps_kuaizhizao_material_shortage_exceptions" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_material_shortage_exceptions" IS '缺料异常记录模型';
        
        -- ============================================
        -- 2. 创建延期异常表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_delivery_delay_exceptions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "planned_end_date" TIMESTAMPTZ NOT NULL,
            "actual_end_date" TIMESTAMPTZ,
            "delay_days" INT NOT NULL,
            "delay_reason" VARCHAR(500),
            "alert_level" VARCHAR(20) NOT NULL DEFAULT 'medium',
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "suggested_action" VARCHAR(50),
            "handled_by" INT,
            "handled_by_name" VARCHAR(100),
            "handled_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_delay_exc_tenant_id" ON "apps_kuaizhizao_delivery_delay_exceptions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_delay_exc_work_order_id" ON "apps_kuaizhizao_delivery_delay_exceptions" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_delay_exc_alert_level" ON "apps_kuaizhizao_delivery_delay_exceptions" ("alert_level");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_delay_exc_status" ON "apps_kuaizhizao_delivery_delay_exceptions" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_delivery_delay_exc_created_at" ON "apps_kuaizhizao_delivery_delay_exceptions" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_delivery_delay_exceptions" IS '交期延期异常记录模型';
        
        -- ============================================
        -- 3. 创建质量异常表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_quality_exceptions" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "exception_type" VARCHAR(50) NOT NULL,
            "work_order_id" INT,
            "work_order_code" VARCHAR(50),
            "material_id" INT,
            "material_code" VARCHAR(50),
            "material_name" VARCHAR(200),
            "batch_no" VARCHAR(50),
            "inspection_record_id" INT,
            "problem_description" TEXT NOT NULL,
            "severity" VARCHAR(20) NOT NULL,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "root_cause" TEXT,
            "corrective_action" TEXT,
            "preventive_action" TEXT,
            "responsible_person_id" INT,
            "responsible_person_name" VARCHAR(100),
            "planned_completion_date" TIMESTAMPTZ,
            "actual_completion_date" TIMESTAMPTZ,
            "verification_result" TEXT,
            "handled_by" INT,
            "handled_by_name" VARCHAR(100),
            "handled_at" TIMESTAMPTZ,
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_tenant_id" ON "apps_kuaizhizao_quality_exceptions" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_exception_type" ON "apps_kuaizhizao_quality_exceptions" ("exception_type");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_work_order_id" ON "apps_kuaizhizao_quality_exceptions" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_material_id" ON "apps_kuaizhizao_quality_exceptions" ("material_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_severity" ON "apps_kuaizhizao_quality_exceptions" ("severity");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_status" ON "apps_kuaizhizao_quality_exceptions" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_quality_exc_created_at" ON "apps_kuaizhizao_quality_exceptions" ("created_at");
        
        COMMENT ON TABLE "apps_kuaizhizao_quality_exceptions" IS '质量异常记录模型';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除异常处理相关模型
    """
    return """
        DROP TABLE IF EXISTS "apps_kuaizhizao_quality_exceptions" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_delivery_delay_exceptions" CASCADE;
        DROP TABLE IF EXISTS "apps_kuaizhizao_material_shortage_exceptions" CASCADE;
    """

