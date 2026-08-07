"""
为物流管理与售后服务新表补齐 BaseModel 审计字段

迁移 526/527 建表时未包含 created_by_name / updated_by_name 等列，
而 ORM BaseModel 继承自 infra BaseModel 会 SELECT 这些字段。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "apps_kuaizhizao_logistics_carriers",
    "apps_kuaizhizao_vehicles",
    "apps_kuaizhizao_drivers",
    "apps_kuaizhizao_freight_orders",
    "apps_kuaizhizao_freight_order_sources",
    "apps_kuaizhizao_freight_tracking_events",
    "apps_kuaizhizao_freight_order_receipts",
    "apps_kuaizhizao_freight_bills",
    "apps_kuaizhizao_freight_bill_items",
    "apps_kuaizhizao_service_assets",
    "apps_kuaizhizao_repair_orders",
    "apps_kuaizhizao_repair_order_items",
    "apps_kuaizhizao_service_dispatch_orders",
    "apps_kuaizhizao_after_sales_spare_part_requisitions",
    "apps_kuaizhizao_after_sales_spare_part_requisition_items",
    "apps_kuaizhizao_service_settlements",
    "apps_kuaizhizao_service_settlement_items",
    "apps_kuaizhizao_customer_return_visits",
)


def _alter_table_sql(table: str) -> str:
    return f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS created_by INT,
            ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS updated_by INT,
            ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(100);
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    return "".join(_alter_table_sql(table) for table in _TABLES)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
            ALTER TABLE "{table}"
                DROP COLUMN IF EXISTS created_by_name,
                DROP COLUMN IF EXISTS updated_by_name;
            """
        )
    return "".join(parts)
