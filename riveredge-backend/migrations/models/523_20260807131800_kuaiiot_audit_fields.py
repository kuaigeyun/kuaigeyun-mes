"""
快数采表补齐 BaseModel 审计字段（created_by_name 等）

迁移 519/520/521 建表早于全库审计字段约定，ORM 查询会引用缺失列。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_KUAIIOT_TABLES = (
    "apps_kuaiiot_connections",
    "apps_kuaiiot_devices",
    "apps_kuaiiot_tag_definitions",
    "apps_kuaiiot_tag_snapshots",
    "apps_kuaiiot_tag_history",
    "apps_kuaiiot_ingest_dedup",
    "apps_kuaiiot_alert_rules",
    "apps_kuaiiot_alerts",
    "apps_kuaiiot_edge_configs",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for table in _KUAIIOT_TABLES:
        statements.append(
            f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "deleted_by" INT,
            ADD COLUMN IF NOT EXISTS "deleted_by_name" VARCHAR(100);
        """
        )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for table in _KUAIIOT_TABLES:
        statements.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS "deleted_by_name",
            DROP COLUMN IF EXISTS "deleted_by",
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by";
        """
        )
    return "\n".join(statements)
