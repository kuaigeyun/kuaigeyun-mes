"""
为工单表添加 allow_operation_jump 字段

添加工序跳转控制字段，用于控制工单是否允许跳转工序。

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为工单表添加 allow_operation_jump 字段
    """
    return """
        -- 添加 allow_operation_jump 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_orders' 
                AND column_name = 'allow_operation_jump'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_orders" 
                ADD COLUMN "allow_operation_jump" BOOLEAN NOT NULL DEFAULT FALSE;
                COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."allow_operation_jump" IS '是否允许跳转工序（true:允许自由报工, false:下一道工序报工数量不可超过上一道工序）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 allow_operation_jump 字段
    """
    return """
        -- 删除 allow_operation_jump 字段
        ALTER TABLE "apps_kuaizhizao_work_orders" DROP COLUMN IF EXISTS "allow_operation_jump";
    """
