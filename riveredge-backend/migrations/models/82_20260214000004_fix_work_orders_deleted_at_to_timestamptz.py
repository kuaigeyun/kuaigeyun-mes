"""
修复工单表 deleted_at 字段类型

工单表的 deleted_at 原为 TIMESTAMP（无时区），与 created_at/updated_at 等 TIMESTAMPTZ 不一致，
导致 asyncpg 编码时出现 "can't subtract offset-naive and offset-aware datetimes" 错误。
改为 TIMESTAMPTZ 与工单工序、返工单等表保持一致。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders"
        ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'Asia/Shanghai';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaizhizao_work_orders"
        ALTER COLUMN "deleted_at" TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC';
    """
