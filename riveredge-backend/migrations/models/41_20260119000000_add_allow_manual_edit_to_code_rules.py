"""
添加 allow_manual_edit 字段到编码规则表

为编码规则表添加 allow_manual_edit 字段，用于控制是否允许手动填写编码。

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 allow_manual_edit 字段到 core_code_rules 表
    """
    return """
        -- ============================================
        -- 添加 allow_manual_edit 字段到 core_code_rules 表
        -- ============================================
        
        -- 检查字段是否已存在，如果不存在则添加
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'allow_manual_edit'
            ) THEN
                ALTER TABLE "core_code_rules" 
                ADD COLUMN "allow_manual_edit" BOOL NOT NULL DEFAULT true;
                
                COMMENT ON COLUMN "core_code_rules"."allow_manual_edit" IS '允许手动填写（如果为True，用户可以手动修改自动生成的编码）';
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 allow_manual_edit 字段
    """
    return """
        -- ============================================
        -- 删除 allow_manual_edit 字段
        -- ============================================
        
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'allow_manual_edit'
            ) THEN
                ALTER TABLE "core_code_rules" 
                DROP COLUMN "allow_manual_edit";
            END IF;
        END $$;
    """
