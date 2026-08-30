"""ERP 同步绑定：供应商/仓库/采购订单/工单 + external_sync_at。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_NEW_BINDING_TABLES = (
    (
        "apps_master_data_supplier_sync_binding",
        "ux_master_data_supplier_sync_bind_tenant",
        "code",
    ),
    (
        "apps_master_data_warehouse_sync_binding",
        "ux_master_data_warehouse_sync_bind_tenant",
        "code",
    ),
    (
        "apps_kuaizhizao_purchase_order_sync_binding",
        "ux_kuaizhizao_po_sync_bind_tenant",
        "order_code",
    ),
    (
        "apps_kuaizhizao_work_order_sync_binding",
        "ux_kuaizhizao_wo_sync_bind_tenant",
        "code",
    ),
)


def _create_binding_table(table: str, index_name: str, match_default: str) -> str:
    return f"""
        CREATE TABLE IF NOT EXISTS "{table}" (
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL,
            "updated_at" TIMESTAMPTZ NOT NULL,
            "created_by" INT,
            "created_by_name" VARCHAR(100),
            "updated_by" INT,
            "updated_by_name" VARCHAR(100),
            "id" SERIAL NOT NULL PRIMARY KEY,
            "source_type" VARCHAR(20),
            "api_uuid" VARCHAR(36),
            "dataset_uuid" VARCHAR(36),
            "field_mapping" JSONB,
            "match_key_field" VARCHAR(64) NOT NULL DEFAULT '{match_default}',
            "sync_mode" VARCHAR(32) NOT NULL DEFAULT 'manual_full',
            "schedule_interval_minutes" INT NOT NULL DEFAULT 15,
            "last_success_at" TIMESTAMPTZ,
            "last_attempt_at" TIMESTAMPTZ,
            "last_error" TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "{index_name}"
            ON "{table}" ("tenant_id");
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for table, index_name, match_default in _NEW_BINDING_TABLES:
        statements.append(_create_binding_table(table, index_name, match_default))

    for table in (
        "apps_master_data_suppliers",
        "apps_master_data_warehouses",
        "apps_kuaizhizao_purchase_orders",
        "apps_kuaizhizao_work_orders",
    ):
        statements.append(
            f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS external_sync_at TIMESTAMPTZ;
            """
        )
    return "\n".join(statements)


async def downgrade(db: BaseDBAsyncClient) -> str:
    statements = []
    for table in (
        "apps_kuaizhizao_work_orders",
        "apps_kuaizhizao_purchase_orders",
        "apps_master_data_warehouses",
        "apps_master_data_suppliers",
    ):
        statements.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS external_sync_at;
            """
        )
    for table, _, _ in reversed(_NEW_BINDING_TABLES):
        statements.append(f'DROP TABLE IF EXISTS "{table}" CASCADE;')
    return "\n".join(statements)
