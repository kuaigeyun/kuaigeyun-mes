"""
销售订单明细和工单增加 configurable_selections 字段

用于存储用户在下单/开工单时对 BOM 配置位的选择结果。
格式: {"parentMaterialId_configurableGroupId": componentId}

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_items" ADD COLUMN IF NOT EXISTS "configurable_selections" JSONB NULL;
        ALTER TABLE "apps_kuaizhizao_work_orders" ADD COLUMN IF NOT EXISTS "configurable_selections" JSONB NULL;
        ALTER TABLE "apps_kuaizhizao_demand_items" ADD COLUMN IF NOT EXISTS "configurable_selections" JSONB NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_order_items"."configurable_selections" IS '配置位选择（用户在下单时选择的配置位物料），格式 {"parentMaterialId_configurableGroupId": componentId}';
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."configurable_selections" IS '配置位选择（用户在开工单时选择的配置位物料），格式 {"parentMaterialId_configurableGroupId": componentId}';
        COMMENT ON COLUMN "apps_kuaizhizao_demand_items"."configurable_selections" IS '配置位选择（用户选择的配置位物料），格式 {"parentMaterialId_configurableGroupId": componentId}';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_order_items" DROP COLUMN IF EXISTS "configurable_selections";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "configurable_selections";
        ALTER TABLE "apps_kuaizhizao_demand_items" DROP COLUMN IF EXISTS "configurable_selections";
    """
