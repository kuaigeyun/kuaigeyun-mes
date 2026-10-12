"""
付款申请头行 uuid 列改为 VARCHAR(36)，与 Tortoise CharField 及全库约定一致。

862 误用 PostgreSQL UUID 类型，Pydantic 响应校验期望 str。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_kuaizhizao_payment_applications",
    "apps_kuaizhizao_payment_application_lines",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            ALTER COLUMN "uuid" TYPE VARCHAR(36) USING "uuid"::text;
        """
        )
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            ALTER COLUMN "uuid" TYPE UUID USING "uuid"::uuid;
        """
        )
    return "\n".join(parts)
