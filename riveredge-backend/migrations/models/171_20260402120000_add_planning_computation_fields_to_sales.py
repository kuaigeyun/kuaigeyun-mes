"""
销售订单/销售预测表增加计划侧需求计算下推字段，与 Demand 下推同进同退；不改主业务状态机。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "planning_pushed_to_computation" BOOL NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "planning_computation_id" INT;
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "planning_computation_code" VARCHAR(50);
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD COLUMN IF NOT EXISTS "planning_computation_pushed_at" TIMESTAMPTZ;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."planning_pushed_to_computation" IS '计划侧已下推需求计算';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."planning_computation_id" IS '关联需求计算ID';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."planning_computation_code" IS '关联需求计算编码';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."planning_computation_pushed_at" IS '下推需求计算时间';

        ALTER TABLE "apps_kuaizhizao_sales_forecasts" ADD COLUMN IF NOT EXISTS "planning_pushed_to_computation" BOOL NOT NULL DEFAULT FALSE;
        ALTER TABLE "apps_kuaizhizao_sales_forecasts" ADD COLUMN IF NOT EXISTS "planning_computation_id" INT;
        ALTER TABLE "apps_kuaizhizao_sales_forecasts" ADD COLUMN IF NOT EXISTS "planning_computation_code" VARCHAR(50);
        ALTER TABLE "apps_kuaizhizao_sales_forecasts" ADD COLUMN IF NOT EXISTS "planning_computation_pushed_at" TIMESTAMPTZ;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_forecasts"."planning_pushed_to_computation" IS '计划侧已下推需求计算';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_forecasts"."planning_computation_id" IS '关联需求计算ID';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_forecasts"."planning_computation_code" IS '关联需求计算编码';
        COMMENT ON COLUMN "apps_kuaizhizao_sales_forecasts"."planning_computation_pushed_at" IS '下推需求计算时间';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "planning_computation_pushed_at";
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "planning_computation_code";
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "planning_computation_id";
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN IF EXISTS "planning_pushed_to_computation";

        ALTER TABLE "apps_kuaizhizao_sales_forecasts" DROP COLUMN IF EXISTS "planning_computation_pushed_at";
        ALTER TABLE "apps_kuaizhizao_sales_forecasts" DROP COLUMN IF EXISTS "planning_computation_code";
        ALTER TABLE "apps_kuaizhizao_sales_forecasts" DROP COLUMN IF EXISTS "planning_computation_id";
        ALTER TABLE "apps_kuaizhizao_sales_forecasts" DROP COLUMN IF EXISTS "planning_pushed_to_computation";
    """
