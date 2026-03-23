"""
物料/工序/工艺路线/工单/工单工序：超报（固定或按比例）

Author: AI Assistant
Date: 2026-03-23
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" ADD COLUMN IF NOT EXISTS "over_report_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
        ALTER TABLE "apps_master_data_materials" ADD COLUMN IF NOT EXISTS "over_report_value" DECIMAL(12,4) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_master_data_materials"."over_report_mode" IS '超报模式：none/fixed/percent';
        COMMENT ON COLUMN "apps_master_data_materials"."over_report_value" IS '超报值：fixed 为额外数量，percent 为计划数量的百分数';

        ALTER TABLE "apps_master_data_operations" ADD COLUMN IF NOT EXISTS "over_report_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
        ALTER TABLE "apps_master_data_operations" ADD COLUMN IF NOT EXISTS "over_report_value" DECIMAL(12,4) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_master_data_operations"."over_report_mode" IS '超报模式：none/fixed/percent';
        COMMENT ON COLUMN "apps_master_data_operations"."over_report_value" IS '超报值：fixed 为额外数量，percent 为计划数量的百分数';

        ALTER TABLE "apps_master_data_process_routes" ADD COLUMN IF NOT EXISTS "over_report_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
        ALTER TABLE "apps_master_data_process_routes" ADD COLUMN IF NOT EXISTS "over_report_value" DECIMAL(12,4) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_master_data_process_routes"."over_report_mode" IS '路线默认超报模式：none/fixed/percent';
        COMMENT ON COLUMN "apps_master_data_process_routes"."over_report_value" IS '路线默认超报值';

        ALTER TABLE "apps_kuaizhizao_work_orders" ADD COLUMN IF NOT EXISTS "over_report_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
        ALTER TABLE "apps_kuaizhizao_work_orders" ADD COLUMN IF NOT EXISTS "over_report_value" DECIMAL(12,4) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."over_report_mode" IS '工单头超报模式：none/fixed/percent';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."over_report_value" IS '工单头超报值';

        ALTER TABLE "apps_kuaizhizao_work_order_operations" ADD COLUMN IF NOT EXISTS "over_report_mode" VARCHAR(20) NOT NULL DEFAULT 'none';
        ALTER TABLE "apps_kuaizhizao_work_order_operations" ADD COLUMN IF NOT EXISTS "over_report_value" DECIMAL(12,4) NOT NULL DEFAULT 0;
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."over_report_mode" IS '工序行超报模式：none/fixed/percent';
        COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."over_report_value" IS '工序行超报值';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "over_report_mode";
        ALTER TABLE "apps_master_data_materials" DROP COLUMN IF EXISTS "over_report_value";
        ALTER TABLE "apps_master_data_operations" DROP COLUMN IF EXISTS "over_report_mode";
        ALTER TABLE "apps_master_data_operations" DROP COLUMN IF EXISTS "over_report_value";
        ALTER TABLE "apps_master_data_process_routes" DROP COLUMN IF EXISTS "over_report_mode";
        ALTER TABLE "apps_master_data_process_routes" DROP COLUMN IF EXISTS "over_report_value";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "over_report_mode";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "over_report_value";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "over_report_mode";
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "over_report_value";
    """
