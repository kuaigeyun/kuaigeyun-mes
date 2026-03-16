"""
工单增加 variant_attributes 字段

支持配置件（Configure）产品在直接创建工单时指定变体，用于 BOM 变体匹配和物料需求计算。

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders" ADD COLUMN IF NOT EXISTS "variant_attributes" JSONB NULL;
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."variant_attributes" IS '变体属性（配置件专用，用于 BOM 变体匹配）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "variant_attributes";
    """
