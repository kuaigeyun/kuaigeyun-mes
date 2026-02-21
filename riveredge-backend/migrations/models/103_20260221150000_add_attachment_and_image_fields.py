"""
Add images to materials and attachments to documents.

Author: Auto
Date: 2026-02-21
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" ADD "images" JSONB;
        COMMENT ON COLUMN "apps_master_data_materials"."images" IS '产品图片列表';
        
        ALTER TABLE "apps_kuaizhizao_sales_orders" ADD "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_sales_orders"."attachments" IS '附件列表';
        
        ALTER TABLE "apps_kuaizhizao_purchase_orders" ADD "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_orders"."attachments" IS '附件列表';
        
        ALTER TABLE "apps_kuaizhizao_work_orders" ADD "attachments" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."attachments" IS '附件列表';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_master_data_materials" DROP COLUMN "images";
        ALTER TABLE "apps_kuaizhizao_sales_orders" DROP COLUMN "attachments";
        ALTER TABLE "apps_kuaizhizao_purchase_orders" DROP COLUMN "attachments";
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN "attachments";
    """
