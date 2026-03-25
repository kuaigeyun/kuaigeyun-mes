"""
统一需求计算：历史 LRP 归并为 MRP；生产计划 plan_type 同步；采购单来源归一 demand_computation

Date: 2026-03-25
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_demand_computations"
        SET "computation_type" = 'MRP'
        WHERE "computation_type" = 'LRP';

        UPDATE "apps_kuaizhizao_production_plans"
        SET "plan_type" = 'MRP'
        WHERE "plan_type" = 'LRP';

        UPDATE "apps_kuaizhizao_purchase_orders"
        SET "source_type" = 'demand_computation'
        WHERE "source_type" IN ('MRP', 'LRP');

        UPDATE "apps_kuaizhizao_purchase_order_items"
        SET "source_type" = 'demand_computation'
        WHERE "source_type" IN ('MRP', 'LRP');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_purchase_order_items"
        SET "source_type" = 'MRP'
        WHERE "source_type" = 'demand_computation';

        UPDATE "apps_kuaizhizao_purchase_orders"
        SET "source_type" = 'MRP'
        WHERE "source_type" = 'demand_computation';

        -- demand_computations / production_plans 无法可靠恢复 LRP，仅回滚采购来源
    """
