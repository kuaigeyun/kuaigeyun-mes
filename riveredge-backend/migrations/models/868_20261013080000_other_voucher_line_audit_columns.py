"""
其他费用收入/支出明细表补齐 BaseModel 审计与时间字段。

863 建表时行表未含 created_at 等列，保存明细会报 column does not exist。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_kuaicaiwu_other_income_lines",
    "apps_kuaicaiwu_other_expense_lines",
)


def _alter_add_columns(table: str) -> str:
    return f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    return "\n".join(_alter_add_columns(t) for t in _TABLES)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by",
            DROP COLUMN IF EXISTS "updated_at",
            DROP COLUMN IF EXISTS "created_at";
    """
        )
    return "\n".join(parts)
