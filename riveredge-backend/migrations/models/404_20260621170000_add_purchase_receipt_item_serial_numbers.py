"""
采购入库明细增加序列号字段（与模型 PurchaseReceiptItem.serial_numbers 对齐）
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_receipt_items"
        ADD COLUMN IF NOT EXISTS "serial_numbers" JSONB;
        COMMENT ON COLUMN "apps_kuaizhizao_purchase_receipt_items"."serial_numbers"
            IS '序列号列表（JSON格式，存储多个序列号）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_purchase_receipt_items"
        DROP COLUMN IF EXISTS "serial_numbers";
    """
