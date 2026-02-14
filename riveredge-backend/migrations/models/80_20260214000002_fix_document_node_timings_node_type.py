"""
修复 document_node_timings 表 node_type 列

将 node_type 改为允许 NULL，或若不存在则添加可空列。
模型使用 node_code，表中 node_type 若为 NOT NULL 会导致 IntegrityError。

Author: Auto (AI Assistant)
Date: 2026-02-14
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'apps_kuaizhizao_document_node_timings'
                AND column_name = 'node_type'
            ) THEN
                ALTER TABLE apps_kuaizhizao_document_node_timings
                ALTER COLUMN node_type DROP NOT NULL;
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 不恢复 NOT NULL，避免破坏现有数据
    """
