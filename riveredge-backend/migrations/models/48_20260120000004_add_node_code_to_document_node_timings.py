"""
数据库迁移：添加 node_code 字段到单据节点耗时记录表

为 apps_kuaizhizao_document_node_timings 表添加：
- node_code: 节点编码（VARCHAR(50)，允许为空）

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：添加 node_code 字段到单据节点耗时记录表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 添加 node_code 字段
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'apps_kuaizhizao_document_node_timings' 
                AND column_name = 'node_code'
            ) THEN
                ALTER TABLE apps_kuaizhizao_document_node_timings 
                ADD COLUMN node_code VARCHAR(50);
                COMMENT ON COLUMN apps_kuaizhizao_document_node_timings.node_code IS '节点编码（如：created/released/reported/received等）';
                
                -- 创建索引（如果模型定义中有）
                CREATE INDEX IF NOT EXISTS idx_document_node_timings_node_code 
                ON apps_kuaizhizao_document_node_timings(node_code);
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除 node_code 字段
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS idx_document_node_timings_node_code;
        
        -- 删除 node_code 字段
        ALTER TABLE apps_kuaizhizao_document_node_timings 
        DROP COLUMN IF EXISTS node_code;
    """
