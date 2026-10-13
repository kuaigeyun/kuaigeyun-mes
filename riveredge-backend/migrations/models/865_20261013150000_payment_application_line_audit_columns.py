"""
付款申请明细表补齐 BaseModel 审计与时间字段。

862 建表时行表未含 created_at 等列，保存明细会报 column does not exist。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLE = "apps_kuaizhizao_payment_application_lines"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        ALTER TABLE "{_TABLE}"
            ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return f"""
        ALTER TABLE "{_TABLE}"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by",
            DROP COLUMN IF EXISTS "updated_at",
            DROP COLUMN IF EXISTS "created_at";
    """
