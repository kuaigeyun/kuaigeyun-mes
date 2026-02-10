"""
添加 rule_components 字段到编码规则表

为编码规则表添加 rule_components 字段，支持完全可配置的规则组件格式。
同时将 expression 字段改为可空，以支持新旧两种格式。

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 rule_components 字段到 core_code_rules 表，并将 expression 字段改为可空
    """
    return """
        -- ============================================
        -- 添加 rule_components 字段到 core_code_rules 表
        -- ============================================
        
        -- 检查字段是否已存在，如果不存在则添加
        DO $$
        BEGIN
            -- 添加 rule_components 字段（JSONB类型）
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'rule_components'
            ) THEN
                ALTER TABLE "core_code_rules" 
                ADD COLUMN "rule_components" JSONB;
                
                COMMENT ON COLUMN "core_code_rules"."rule_components" IS '规则组件列表（新格式，完全可配置，JSON格式）';
            END IF;
            
            -- 将 expression 字段改为可空（如果还不是可空的话）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'expression'
                AND is_nullable = 'NO'
            ) THEN
                ALTER TABLE "core_code_rules" 
                ALTER COLUMN "expression" DROP NOT NULL;
            END IF;
            
            -- 扩展 expression 字段长度（如果当前长度小于500）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'expression'
                AND character_maximum_length < 500
            ) THEN
                ALTER TABLE "core_code_rules" 
                ALTER COLUMN "expression" TYPE VARCHAR(500);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除 rule_components 字段，恢复 expression 字段为必填
    """
    return """
        -- ============================================
        -- 删除 rule_components 字段
        -- ============================================
        
        DO $$
        BEGIN
            -- 删除 rule_components 字段
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'rule_components'
            ) THEN
                ALTER TABLE "core_code_rules" 
                DROP COLUMN "rule_components";
            END IF;
            
            -- 恢复 expression 字段为必填（如果当前是可空的）
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_rules' 
                AND column_name = 'expression'
                AND is_nullable = 'YES'
            ) THEN
                -- 先为所有空的expression设置默认值
                UPDATE "core_code_rules" 
                SET "expression" = '{SEQ:5}' 
                WHERE "expression" IS NULL;
                
                -- 然后设置为必填
                ALTER TABLE "core_code_rules" 
                ALTER COLUMN "expression" SET NOT NULL;
            END IF;
        END $$;
    """
