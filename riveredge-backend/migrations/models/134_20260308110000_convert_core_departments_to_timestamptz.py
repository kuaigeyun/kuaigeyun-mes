"""
将 core_departments 表时间列从 TIMESTAMP 改为 TIMESTAMPTZ

core_departments 的 created_at、updated_at、deleted_at 原为 TIMESTAMP（无时区），
与 core_dictionary_items、core_files 等表不一致，导致 asyncpg 编码时出现
"can't subtract offset-naive and offset-aware datetimes" 错误。
改为 TIMESTAMPTZ 与项目其他表保持一致，支持 timezone-aware datetime 写入。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_departments"
        ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "core_departments"
        ALTER COLUMN "created_at" TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN "updated_at" TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN "deleted_at" TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC';
    """
