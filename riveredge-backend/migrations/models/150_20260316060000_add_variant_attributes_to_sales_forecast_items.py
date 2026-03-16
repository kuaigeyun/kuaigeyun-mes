"""
销售预测明细增加 variant_attributes 字段

支持配置件（Configure）物料在销售预测中指定变体，同步至需求后用于 BOM 变体匹配。

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_forecast_items" ADD COLUMN IF NOT EXISTS "variant_attributes" JSONB NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_forecast_items"."variant_attributes" IS '变体属性（配置件专用，用于 BOM 变体匹配）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_sales_forecast_items" DROP COLUMN IF EXISTS "variant_attributes";
    """
