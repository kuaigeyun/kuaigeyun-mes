"""
工单批号/序列号追踪字段迁移

为工单表增加 planned/confirmed 批号序列号及规则引用；
为成品入库明细增加 serial_numbers 字段。

Author: RiverEdge Team
Date: 2026-06-13
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'tracking_mode'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "tracking_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."tracking_mode" IS '追踪模式 none/batch/serial/both（开单时由物料主数据快照）';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'planned_batch_no'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "planned_batch_no" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."planned_batch_no" IS '计划批号（开单指定或下达占号）';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'confirmed_batch_no'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "confirmed_batch_no" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."confirmed_batch_no" IS '确认批号（完工确认，未填则沿用计划批号）';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'planned_serial_no'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "planned_serial_no" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."planned_serial_no" IS '计划序列号（序列号子工单每件一号）';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'confirmed_serial_no'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "confirmed_serial_no" VARCHAR(100) NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."confirmed_serial_no" IS '确认序列号（完工确认，未填则沿用计划序列号）';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'batch_rule_id'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "batch_rule_id" INT NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."batch_rule_id" IS '批号规则ID（开单覆盖物料默认）';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_work_orders'
                AND column_name = 'serial_rule_id'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders"
                ADD COLUMN "serial_rule_id" INT NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."serial_rule_id" IS '序列号规则ID（开单覆盖物料默认）';
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_finished_goods_receipt_items'
                AND column_name = 'serial_numbers'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_finished_goods_receipt_items"
                ADD COLUMN "serial_numbers" JSONB NULL;
                COMMENT ON COLUMN "apps_kuaizhizao_finished_goods_receipt_items"."serial_numbers" IS '序列号列表（JSON数组）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_finished_goods_receipt_items" DROP COLUMN IF EXISTS "serial_numbers";

        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "serial_rule_id";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "batch_rule_id";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "confirmed_serial_no";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "planned_serial_no";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "confirmed_batch_no";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "planned_batch_no";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "tracking_mode";
    """
