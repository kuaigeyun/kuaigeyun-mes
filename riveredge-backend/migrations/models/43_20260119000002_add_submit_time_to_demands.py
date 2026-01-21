"""
添加 submit_time 字段到需求表

为需求表添加 submit_time 字段，用于记录需求提交时间，支持耗时统计功能。

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 submit_time 字段到 apps_kuaizhizao_demands 表
    """
    return """
        -- ============================================
        -- 添加 submit_time 字段到 apps_kuaizhizao_demands 表
        -- ============================================
        
        -- 检查字段是否已存在，如果不存在则添加
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_demands' 
                AND column_name = 'submit_time'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_demands" 
                ADD COLUMN "submit_time" TIMESTAMPTZ;
                COMMENT ON COLUMN "apps_kuaizhizao_demands"."submit_time" IS '提交时间（用于耗时统计）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 submit_time 字段
    """
    return """
        -- ============================================
        -- 删除 submit_time 字段从 apps_kuaizhizao_demands 表
        -- ============================================
        
        -- 检查字段是否已存在，如果存在则删除
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_demands' 
                AND column_name = 'submit_time'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_demands" 
                DROP COLUMN "submit_time";
            END IF;
        END $$;
    """
