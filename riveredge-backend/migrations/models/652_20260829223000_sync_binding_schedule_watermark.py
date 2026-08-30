"""同步绑定表：定时模式水位与间隔。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_master_data_customer_sync_binding",
    "apps_master_data_material_sync_binding",
    "apps_master_data_material_unit_sync_binding",
    "apps_master_data_material_group_sync_binding",
    "apps_kuaizhizao_sales_order_sync_binding",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for table in _TABLES:
        statements.append(
            f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS schedule_interval_minutes INT NOT NULL DEFAULT 15,
            ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_error TEXT;
            """
        )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for table in _TABLES:
        statements.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS last_error,
            DROP COLUMN IF EXISTS last_attempt_at,
            DROP COLUMN IF EXISTS last_success_at,
            DROP COLUMN IF EXISTS schedule_interval_minutes;
            """
        )
    return "\n".join(statements)
