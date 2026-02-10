"""
添加工单工序表和工单冻结字段

P0优先级迁移：
1. 创建 apps_kuaizhizao_work_order_operations 表（工单工序）
2. 为 apps_kuaizhizao_work_orders 表添加冻结相关字段

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加工单工序表和工单冻结字段
    """
    return """
        -- ============================================
        -- 1. 创建工单工序表
        -- ============================================
        CREATE TABLE IF NOT EXISTS "apps_kuaizhizao_work_order_operations" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "id" SERIAL NOT NULL PRIMARY KEY,
            "work_order_id" INT NOT NULL,
            "work_order_code" VARCHAR(50) NOT NULL,
            "operation_id" INT NOT NULL,
            "operation_code" VARCHAR(50) NOT NULL,
            "operation_name" VARCHAR(200) NOT NULL,
            "sequence" INT NOT NULL,
            "workshop_id" INT,
            "workshop_name" VARCHAR(200),
            "work_center_id" INT,
            "work_center_name" VARCHAR(200),
            "planned_start_date" TIMESTAMPTZ,
            "planned_end_date" TIMESTAMPTZ,
            "actual_start_date" TIMESTAMPTZ,
            "actual_end_date" TIMESTAMPTZ,
            "standard_time" DECIMAL(10,2),
            "setup_time" DECIMAL(10,2),
            "completed_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "qualified_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "unqualified_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "remarks" TEXT,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_apps_kuaizh_tenant__work_order_seq" UNIQUE ("tenant_id", "work_order_id", "sequence")
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_tenant_id" ON "apps_kuaizhizao_work_order_operations" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_work_order_id" ON "apps_kuaizhizao_work_order_operations" ("work_order_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_operation_id" ON "apps_kuaizhizao_work_order_operations" ("operation_id");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_sequence" ON "apps_kuaizhizao_work_order_operations" ("sequence");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_status" ON "apps_kuaizhizao_work_order_operations" ("status");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_planned_start" ON "apps_kuaizhizao_work_order_operations" ("planned_start_date");
        CREATE INDEX IF NOT EXISTS "idx_apps_kuaizh_work_order_ops_created_at" ON "apps_kuaizhizao_work_order_operations" ("created_at");
        
        -- 添加注释
        COMMENT ON TABLE "apps_kuaizhizao_work_order_operations" IS '工单工序模型';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."uuid" IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."tenant_id" IS '组织 ID（用于多组织数据隔离）';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."work_order_id" IS '工单ID（关联WorkOrder）';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."sequence" IS '工序顺序（从1开始）';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."status" IS '工序状态（pending/in_progress/completed/cancelled）';
        
        -- ============================================
        -- 2. 为工单表添加冻结相关字段
        -- ============================================
        -- 添加 is_frozen 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_orders' 
                AND column_name = 'is_frozen'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders" 
                ADD COLUMN "is_frozen" BOOLEAN NOT NULL DEFAULT FALSE;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."is_frozen" IS '是否冻结';
            END IF;
        END $$;
        
        -- 添加 freeze_reason 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_orders' 
                AND column_name = 'freeze_reason'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders" 
                ADD COLUMN "freeze_reason" TEXT;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."freeze_reason" IS '冻结原因';
            END IF;
        END $$;
        
        -- 添加 frozen_at 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_orders' 
                AND column_name = 'frozen_at'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders" 
                ADD COLUMN "frozen_at" TIMESTAMPTZ;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."frozen_at" IS '冻结时间';
            END IF;
        END $$;
        
        -- 添加 frozen_by 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_orders' 
                AND column_name = 'frozen_by'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders" 
                ADD COLUMN "frozen_by" INT;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."frozen_by" IS '冻结人ID';
            END IF;
        END $$;
        
        -- 添加 frozen_by_name 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_orders' 
                AND column_name = 'frozen_by_name'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders" 
                ADD COLUMN "frozen_by_name" VARCHAR(100);
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."frozen_by_name" IS '冻结人姓名';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除工单工序表和工单冻结字段
    """
    return """
        -- 删除工单工序表
        DROP TABLE IF EXISTS "apps_kuaizhizao_work_order_operations" CASCADE;
        
        -- 删除工单冻结字段
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "is_frozen";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "freeze_reason";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "frozen_at";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "frozen_by";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "frozen_by_name";
    """

