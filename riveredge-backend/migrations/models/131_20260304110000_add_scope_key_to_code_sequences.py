"""
添加 scope_key 字段到 core_code_sequences 表

用于支持按作用域（如物料ID）隔离的编码序号，与 CodeSequence 模型保持一致。

Author: RiverEdge Team
Date: 2026-03-04
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：添加 scope_key 字段到 core_code_sequences 表
    """
    return """
        -- ============================================
        -- 添加 scope_key 字段到 core_code_sequences 表
        -- ============================================
        
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'core_code_sequences' 
                AND column_name = 'scope_key'
            ) THEN
                ALTER TABLE "core_code_sequences" 
                ADD COLUMN "scope_key" VARCHAR(100) NOT NULL DEFAULT '';
                
                COMMENT ON COLUMN "core_code_sequences"."scope_key" IS '作用域Key（用于按字段隔离计数）';
            END IF;
        END $$;
    """
