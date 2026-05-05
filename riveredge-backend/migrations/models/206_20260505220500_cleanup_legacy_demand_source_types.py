"""
一次性历史数据清理：
修正 Demand 历史来源类型错配，避免全链路追溯出现「销售订单/销售预测 -> 需求计划」伪链路。

清理目标：
1) 能明确关联到销售订单的需求，统一为 sales_order / MTO。
2) 能明确关联到销售预测的需求，统一为 sales_forecast / MTS。
3) demand_type 已是 sales_order/sales_forecast 但 source_type 缺失或错误时，补齐 source_type。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        /* 1) 先修正可明确识别为销售订单来源的数据（优先级高于销售预测） */
        UPDATE "apps_kuaizhizao_demands" AS d
        SET
            "demand_type" = 'sales_order',
            "source_type" = 'sales_order',
            "business_mode" = CASE
                WHEN COALESCE(NULLIF(d."business_mode", ''), '') = '' THEN 'MTO'
                ELSE d."business_mode"
            END,
            "source_code" = CASE
                WHEN COALESCE(NULLIF(d."source_code", ''), '') = '' THEN so."order_code"
                ELSE d."source_code"
            END
        FROM "apps_kuaizhizao_sales_orders" AS so
        WHERE d."tenant_id" = so."tenant_id"
          AND d."deleted_at" IS NULL
          AND (
                (d."source_id" IS NOT NULL AND d."source_id" = so."id")
                OR COALESCE(NULLIF(d."source_code", ''), d."demand_code") = so."order_code"
              )
          AND (
                COALESCE(d."demand_type", '') <> 'sales_order'
                OR COALESCE(d."source_type", '') <> 'sales_order'
                OR COALESCE(NULLIF(d."source_code", ''), '') = ''
              );

        /* 2) 再修正销售预测来源；已被识别为 sales_order 的不再覆盖 */
        UPDATE "apps_kuaizhizao_demands" AS d
        SET
            "demand_type" = 'sales_forecast',
            "source_type" = 'sales_forecast',
            "business_mode" = CASE
                WHEN COALESCE(NULLIF(d."business_mode", ''), '') = '' THEN 'MTS'
                ELSE d."business_mode"
            END,
            "source_code" = CASE
                WHEN COALESCE(NULLIF(d."source_code", ''), '') = '' THEN sf."forecast_code"
                ELSE d."source_code"
            END
        FROM "apps_kuaizhizao_sales_forecasts" AS sf
        WHERE d."tenant_id" = sf."tenant_id"
          AND d."deleted_at" IS NULL
          AND COALESCE(d."demand_type", '') <> 'sales_order'
          AND (
                (d."source_id" IS NOT NULL AND d."source_id" = sf."id")
                OR COALESCE(NULLIF(d."source_code", ''), d."demand_code") = sf."forecast_code"
              )
          AND (
                COALESCE(d."demand_type", '') <> 'sales_forecast'
                OR COALESCE(d."source_type", '') <> 'sales_forecast'
                OR COALESCE(NULLIF(d."source_code", ''), '') = ''
              );

        /* 3) 补齐 source_type：demand_type 已正确但 source_type 为空/错误 */
        UPDATE "apps_kuaizhizao_demands"
        SET "source_type" = "demand_type"
        WHERE "deleted_at" IS NULL
          AND "demand_type" IN ('sales_order', 'sales_forecast')
          AND COALESCE("source_type", '') <> "demand_type";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 历史数据清理不可无损回滚：保持 no-op
    return """SELECT 1;"""

