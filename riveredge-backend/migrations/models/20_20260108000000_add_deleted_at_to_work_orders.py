"""
添加工单表的 deleted_at 字段

为工单表添加软删除字段，支持软删除功能。

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 deleted_at 字段
    """
    return """
        -- ============================================
        -- 为工单表添加 deleted_at 字段
        -- ============================================
        ALTER TABLE "apps_kuaizhizao_work_orders" 
        ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
        
        -- 添加字段注释
        COMMENT ON COLUMN "apps_kuaizhizao_work_orders"."deleted_at" IS '删除时间（软删除）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 deleted_at 字段
    """
    return """
        -- 删除 deleted_at 字段
        ALTER TABLE "apps_kuaizhizao_work_orders" 
        DROP COLUMN IF EXISTS "deleted_at";
    """
