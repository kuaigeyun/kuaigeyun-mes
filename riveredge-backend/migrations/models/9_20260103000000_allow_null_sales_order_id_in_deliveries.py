"""
允许销售出库单的sales_order_id为NULL

支持MTS模式，允许销售出库单在没有销售订单的情况下创建。

变更内容：
- 修改 apps_kuaizhizao_sales_deliveries 表的 sales_order_id 字段，允许为NULL
- 修改 apps_kuaizhizao_sales_deliveries 表的 sales_order_code 字段，允许为NULL
- 更新外键约束，使其支持NULL值

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：允许sales_order_id和sales_order_code为NULL
    
    此迁移将修改apps_kuaizhizao_sales_deliveries表，使其支持MTS模式（没有销售订单）。
    """
    return """
        -- ============================================
        -- 修改 apps_kuaizhizao_sales_deliveries 表
        -- ============================================
        
        -- 删除现有的外键约束（如果存在）
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_apps_kuaizhizao_sales_deliveries_sales_order_id' 
                AND conrelid = 'apps_kuaizhizao_sales_deliveries'::regclass
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                DROP CONSTRAINT "fk_apps_kuaizhizao_sales_deliveries_sales_order_id";
            END IF;
        END $$;
        
        -- 修改 sales_order_id 字段，允许为NULL
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        ALTER COLUMN "sales_order_id" DROP NOT NULL;
        
        -- 修改 sales_order_code 字段，允许为NULL（如果当前不允许为NULL）
        DO $$
        BEGIN
            -- 检查字段是否允许NULL
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
                AND column_name = 'sales_order_code' 
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ALTER COLUMN "sales_order_code" DROP NOT NULL;
            END IF;
        END $$;
        
        -- 重新添加外键约束，支持NULL值
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_apps_kuaizhizao_sales_deliveries_sales_order_id' 
                AND conrelid = 'apps_kuaizhizao_sales_deliveries'::regclass
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD CONSTRAINT "fk_apps_kuaizhizao_sales_deliveries_sales_order_id" 
                FOREIGN KEY ("sales_order_id") 
                REFERENCES "apps_kuaizhizao_sales_orders"("id") 
                ON DELETE SET NULL;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：恢复sales_order_id为NOT NULL
    
    注意：此操作可能会失败，如果表中存在NULL值。
    """
    return """
        -- 删除外键约束
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_apps_kuaizhizao_sales_deliveries_sales_order_id' 
                AND conrelid = 'apps_kuaizhizao_sales_deliveries'::regclass
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                DROP CONSTRAINT "fk_apps_kuaizhizao_sales_deliveries_sales_order_id";
            END IF;
        END $$;
        
        -- 清理NULL值（设置为0或删除记录，根据业务需求）
        -- 注意：这里只是示例，实际降级时需要根据业务逻辑处理NULL值
        UPDATE "apps_kuaizhizao_sales_deliveries" 
        SET "sales_order_id" = 0 
        WHERE "sales_order_id" IS NULL;
        
        -- 恢复NOT NULL约束
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        ALTER COLUMN "sales_order_id" SET NOT NULL;
        
        ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
        ALTER COLUMN "sales_order_code" SET NOT NULL;
        
        -- 重新添加外键约束
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_apps_kuaizhizao_sales_deliveries_sales_order_id' 
                AND conrelid = 'apps_kuaizhizao_sales_deliveries'::regclass
            ) THEN
                ALTER TABLE "apps_kuaizhizao_sales_deliveries" 
                ADD CONSTRAINT "fk_apps_kuaizhizao_sales_deliveries_sales_order_id" 
                FOREIGN KEY ("sales_order_id") 
                REFERENCES "apps_kuaizhizao_sales_orders"("id") 
                ON DELETE CASCADE;
            END IF;
        END $$;
    """

