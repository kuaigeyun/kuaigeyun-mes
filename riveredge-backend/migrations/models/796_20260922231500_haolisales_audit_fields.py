"""
销售跟踪表补齐 BaseModel 审计字段。

迁移 784 建表时仅有 created_by_user_id / created_by_name，
漏了 created_by / updated_by / updated_by_name，列表 SELECT 会 500。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "haolisales_order_tracking",
    "haolisales_order_tracking_delivery",
    "haolisales_order_tracking_payment",
    "haolisales_monthly_factory_ledger",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
            """
        )
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by";
            """
        )
    # created_by_name 在 order_tracking / monthly_factory_ledger 建表时已有，不在降级里删
    return "\n".join(parts)
