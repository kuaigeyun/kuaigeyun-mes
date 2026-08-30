"""同步绑定表补齐 BaseModel 审计字段（647/648 建表时未含 created_by_name 等）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    tables = (
        "apps_kuaizhizao_sales_order_sync_binding",
        "apps_master_data_customer_sync_binding",
        "apps_master_data_material_sync_binding",
    )
    statements = []
    for table in tables:
        statements.append(
            f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS created_by INT,
            ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS updated_by INT,
            ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(100);
            """
        )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    tables = (
        "apps_kuaizhizao_sales_order_sync_binding",
        "apps_master_data_customer_sync_binding",
        "apps_master_data_material_sync_binding",
    )
    statements = []
    for table in tables:
        statements.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS updated_by_name,
            DROP COLUMN IF EXISTS updated_by,
            DROP COLUMN IF EXISTS created_by_name,
            DROP COLUMN IF EXISTS created_by;
            """
        )
    return "\n".join(statements)
