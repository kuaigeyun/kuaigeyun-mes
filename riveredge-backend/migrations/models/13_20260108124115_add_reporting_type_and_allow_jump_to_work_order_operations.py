"""
为工单工序表添加 reporting_type 和 allow_jump 字段

添加报工类型和跳转规则字段，用于支持不同的报工方式和工序跳转控制。

Author: Luigi Lu
Date: 2026-01-08
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为工单工序表添加 reporting_type 和 allow_jump 字段
    """
    return """
        -- 添加 reporting_type 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_order_operations' 
                AND column_name = 'reporting_type'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_order_operations" 
                ADD COLUMN "reporting_type" VARCHAR(20) NOT NULL DEFAULT 'quantity';
                COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."reporting_type" IS '报工类型（quantity:按数量报工, status:按状态报工）';
            END IF;
        END $$;
        
        -- 添加 allow_jump 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_work_order_operations' 
                AND column_name = 'allow_jump'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_work_order_operations" 
                ADD COLUMN "allow_jump" BOOLEAN NOT NULL DEFAULT FALSE;
                COMMENT ON COLUMN "apps_kuaizhizao_work_order_operations"."allow_jump" IS '是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 reporting_type 和 allow_jump 字段
    """
    return """
        -- 删除 reporting_type 字段
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "reporting_type";
        
        -- 删除 allow_jump 字段
        ALTER TABLE "apps_kuaizhizao_work_order_operations" DROP COLUMN IF EXISTS "allow_jump";
    """
