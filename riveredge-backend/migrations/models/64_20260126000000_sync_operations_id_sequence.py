"""
同步工序表 id 序列，修复主键冲突

软删除或数据导入后，id 序列可能落后于 MAX(id)，导致 INSERT 时重复键违反
seed_master_data_operations_pkey / apps_master_data_operations_pkey。
将序列重置为 COALESCE(MAX(id), 1)，确保下一次 INSERT 使用 max(id)+1。

Author: Auto
Date: 2026-01-26
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        DECLARE
            seq_name text;
        BEGIN
            seq_name := pg_get_serial_sequence('apps_master_data_operations', 'id');
            IF seq_name IS NOT NULL THEN
                EXECUTE format(
                    'SELECT setval(%L::regclass, (SELECT COALESCE(MAX(id), 1) FROM apps_master_data_operations))',
                    seq_name
                );
            END IF;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "SELECT 1;  /* 序列同步无需回滚 */"
